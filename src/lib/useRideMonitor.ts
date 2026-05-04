/**
 * useRideMonitor — Intelligent ride safety monitoring hook.
 *
 * Runs a 10-second polling loop while the ride is active and detects:
 *   1. **Unexpected Stop** — vehicle speed ≈ 0 for > 2 min AND > 200 m from destination.
 *   2. **Route Deviation** — vehicle > 300 m from the nearest point on the expected route.
 *
 * When a threat is detected the hook exposes an `alertType` and a 15-second countdown.
 * If the user does not dismiss ("I'm Safe") before the countdown expires, `sosTriggered`
 * flips to `true` so the parent can fire its own SOS logic.
 *
 * ── Design notes ──
 * • Fully modular — does NOT touch the existing SOS / risk-score system in CabPage.
 * • All intervals are cleaned up on unmount and when the ride stops → no leaks.
 * • Timer resets cleanly when the user dismisses an alert.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import * as turf from "@turf/turf"

// ── Types ──────────────────────────────────────────────────────────────────

interface Coord {
  lat: number
  lng: number
}

export type RideAlertType = "unexpected-stop" | "route-deviation" | null

export interface UseRideMonitorOptions {
  /** Is the ride currently in progress? */
  isRiding: boolean
  /** Is the ride paused (user-initiated stop — skip detection). */
  isPaused?: boolean
  /** Ref to the latest vehicle position — read every monitoring tick. */
  currentPosRef: React.RefObject<Coord>
  /** Drop-off location (may be null until user picks one). */
  destination: Coord | null
  /** OSRM route coordinates — used for deviation distance calc. */
  routeCoords: Coord[]
}

export interface UseRideMonitorReturn {
  alertType: RideAlertType
  countdown: number
  /** User confirms they are safe — resets all timers. */
  dismiss: () => void
  /** User manually triggers SOS immediately. */
  triggerSOS: () => void
  /** True after countdown expires OR user presses "Trigger SOS Now". */
  sosTriggered: boolean
  /** Force-show an alert (for demo / testing). */
  forceAlert: (type: "unexpected-stop" | "route-deviation") => void
}

// ── Thresholds ─────────────────────────────────────────────────────────────

const MONITOR_INTERVAL_MS = 10_000 // 10 s
const STOP_DURATION_MS = 120_000 // 2 min of near-zero movement
const STOP_MOVEMENT_M = 5 // < 5 m between ticks ≈ stationary
const DROP_PROXIMITY_M = 200 // must be > 200 m from dest to flag
const DEVIATION_THRESHOLD_M = 300 // > 300 m off the expected route
const COUNTDOWN_SECONDS = 15

// ── Hook ───────────────────────────────────────────────────────────────────

export function useRideMonitor(options: UseRideMonitorOptions): UseRideMonitorReturn {
  const { isRiding, isPaused = false, currentPosRef, destination, routeCoords } = options

  // Keep a ref so the interval closure always reads the latest paused state
  const isPausedRef = useRef(isPaused)
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])

  // ── State exposed to the consumer ──
  const [alertType, setAlertType] = useState<RideAlertType>(null)
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [sosTriggered, setSosTriggered] = useState(false)

  // ── Internal refs ──
  const lastPosRef = useRef<Coord | null>(null)
  const stoppedSinceRef = useRef<number | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const monitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertTypeRef = useRef<RideAlertType>(null)
  // Keep a ref-copy of the mutable props so the interval closure always reads fresh values
  const destinationRef = useRef<Coord | null>(destination)
  const routeCoordsRef = useRef<Coord[]>(routeCoords)

  // Sync refs with props
  useEffect(() => { destinationRef.current = destination }, [destination])
  useEffect(() => { routeCoordsRef.current = routeCoords }, [routeCoords])

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Haversine distance in metres via turf. */
  const distanceM = useCallback((a: Coord, b: Coord): number => {
    return turf.distance(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat]), { units: "meters" })
  }, [])

  /** Start the 15-second countdown (no-op if already running). */
  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) return
    setCountdown(COUNTDOWN_SECONDS)
    let remaining = COUNTDOWN_SECONDS
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current)
          countdownIntervalRef.current = null
        }
        setSosTriggered(true)
      }
    }, 1000)
  }, [])

  /** Stop the countdown interval (used by dismiss / cleanup). */
  const stopCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
  }, [])

  // ── Public actions ───────────────────────────────────────────────────────

  const dismiss = useCallback(() => {
    stopCountdown()
    setAlertType(null)
    alertTypeRef.current = null
    setCountdown(COUNTDOWN_SECONDS)
    setSosTriggered(false)
    stoppedSinceRef.current = null // reset stop timer so it must accumulate again
  }, [stopCountdown])

  const triggerSOS = useCallback(() => {
    stopCountdown()
    setSosTriggered(true)
  }, [stopCountdown])

  /** Force-show an alert — purely for demo / presentation. */
  const forceAlert = useCallback((type: "unexpected-stop" | "route-deviation") => {
    if (alertTypeRef.current) return // already showing
    setAlertType(type)
    alertTypeRef.current = type
    startCountdown()
  }, [startCountdown])

  // ── Core monitoring loop ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isRiding) {
      // Ride ended — full cleanup
      if (monitorIntervalRef.current) { clearInterval(monitorIntervalRef.current); monitorIntervalRef.current = null }
      stopCountdown()
      lastPosRef.current = null
      stoppedSinceRef.current = null
      setAlertType(null)
      alertTypeRef.current = null
      setCountdown(COUNTDOWN_SECONDS)
      setSosTriggered(false)
      return
    }

    // Seed last-position with the current one so the first tick has a baseline.
    lastPosRef.current = currentPosRef.current ? { ...currentPosRef.current } : null

    monitorIntervalRef.current = setInterval(() => {
      // Skip checks while ride is paused (user-initiated stop) or alert is showing
      if (isPausedRef.current) { stoppedSinceRef.current = null; return }
      if (alertTypeRef.current) return

      const pos = currentPosRef.current
      if (!pos) return
      const last = lastPosRef.current
      if (!last) { lastPosRef.current = { ...pos }; return }

      const movementM = distanceM(last, pos)

      // ── Check 1 — Unexpected Stop ────────────────────────────────────────
      if (movementM < STOP_MOVEMENT_M) {
        if (!stoppedSinceRef.current) stoppedSinceRef.current = Date.now()

        const stoppedMs = Date.now() - stoppedSinceRef.current

        if (stoppedMs >= STOP_DURATION_MS && destinationRef.current) {
          const toDest = distanceM(pos, destinationRef.current)
          if (toDest > DROP_PROXIMITY_M) {
            setAlertType("unexpected-stop")
            alertTypeRef.current = "unexpected-stop"
            startCountdown()
            lastPosRef.current = { ...pos }
            return
          }
        }
      } else {
        stoppedSinceRef.current = null // moving — reset stop clock
      }

      // ── Check 2 — Route Deviation ───────────────────────────────────────
      const rc = routeCoordsRef.current
      if (rc.length >= 2) {
        const routeLine = turf.lineString(rc.map(c => [c.lng, c.lat]))
        const nearest = turf.nearestPointOnLine(routeLine, turf.point([pos.lng, pos.lat]), { units: "meters" })
        const distFromRoute = nearest.properties.dist ?? 0

        if (distFromRoute > DEVIATION_THRESHOLD_M) {
          setAlertType("route-deviation")
          alertTypeRef.current = "route-deviation"
          startCountdown()
        }
      }

      lastPosRef.current = { ...pos }
    }, MONITOR_INTERVAL_MS)

    return () => {
      if (monitorIntervalRef.current) { clearInterval(monitorIntervalRef.current); monitorIntervalRef.current = null }
      stopCountdown()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRiding])

  return { alertType, countdown, dismiss, triggerSOS, sosTriggered, forceAlert }
}
