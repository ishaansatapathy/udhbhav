/**
 * useSafeWalkState — Safe Walk state machine hook.
 *
 * States: IDLE → ACTIVE → ALERT
 *
 * Exposes:
 *  - safeWalkState   : current snapshot
 *  - startWalk()     : begin monitoring
 *  - stopWalk()      : full reset
 *  - simulateStop()  : freeze lastMoveTime; triggers ALERT after 5 s
 *  - resetAlert()    : YES answer — back to ACTIVE
 */

import { useState, useRef, useCallback, useEffect } from "react"

// ── Types ──────────────────────────────────────────────────────────────────────

export type SafeWalkStatus = "IDLE" | "ACTIVE" | "ALERT"

export interface LatLng {
    lat: number
    lng: number
}

export interface SafeWalkState {
    active: boolean
    status: SafeWalkStatus
    startLocation: LatLng | null
    currentLocation: LatLng | null
    lastMoveTime: number | null
    guardianConnected: boolean
}

const IDLE_STATE: SafeWalkState = {
    active: false,
    status: "IDLE",
    startLocation: null,
    currentLocation: null,
    lastMoveTime: null,
    guardianConnected: true,
}

// ── Haversine helper ───────────────────────────────────────────────────────────

function haversineM(a: LatLng, b: LatLng) {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const sin = Math.sin
    const cos = Math.cos
    const h = sin(dLat / 2) ** 2 + cos(toRad(a.lat)) * cos(toRad(b.lat)) * sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSafeWalkState(seedLocation: LatLng) {
    const [state, setState] = useState<SafeWalkState>(IDLE_STATE)

    // refs
    const driftIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const stopSimActiveRef = useRef(false)

    // path history for map polyline
    const [path, setPath] = useState<LatLng[]>([])

    const clearTimers = useCallback(() => {
        if (driftIntervalRef.current) { clearInterval(driftIntervalRef.current); driftIntervalRef.current = null }
        if (alertTimerRef.current) { clearTimeout(alertTimerRef.current); alertTimerRef.current = null }
    }, [])

    /** Start GPS drift simulation (new position every 3 s) */
    const startDrift = useCallback((initial: LatLng) => {
        let cur: LatLng = { ...initial }

        driftIntervalRef.current = setInterval(() => {
            if (stopSimActiveRef.current) return   // freeze position while stop-sim active

            const next: LatLng = {
                lat: cur.lat + (Math.random() - 0.5) * 0.0003,
                lng: cur.lng + (Math.random() - 0.5) * 0.0003,
            }

            // only update if moved > 2 m
            if (haversineM(cur, next) > 2) {
                cur = next
                setPath(prev => [...prev, next])
                setState(prev =>
                    prev.active && prev.status === "ACTIVE"
                        ? { ...prev, currentLocation: next, lastMoveTime: Date.now() }
                        : prev
                )
            }
        }, 3000)
    }, [])

    const startWalk = useCallback(() => {
        clearTimers()
        stopSimActiveRef.current = false
        setPath([seedLocation])

        setState({
            active: true,
            status: "ACTIVE",
            startLocation: seedLocation,
            currentLocation: seedLocation,
            lastMoveTime: Date.now(),
            guardianConnected: true,
        })

        startDrift(seedLocation)
    }, [seedLocation, clearTimers, startDrift])

    const stopWalk = useCallback(() => {
        clearTimers()
        stopSimActiveRef.current = false
        setState(IDLE_STATE)
        setPath([])
    }, [clearTimers])

    /** Freeze position updates; fire ALERT after 5 s */
    const simulateStop = useCallback(() => {
        if (stopSimActiveRef.current) return
        stopSimActiveRef.current = true

        // Clear any existing alert timer
        if (alertTimerRef.current) clearTimeout(alertTimerRef.current)

        alertTimerRef.current = setTimeout(() => {
            setState(prev =>
                prev.active && prev.status === "ACTIVE"
                    ? { ...prev, status: "ALERT" }
                    : prev
            )
        }, 5000)
    }, [])

    /** User confirmed safe → back to ACTIVE */
    const resetAlert = useCallback(() => {
        stopSimActiveRef.current = false
        setState(prev =>
            prev.active && prev.status === "ALERT"
                ? { ...prev, status: "ACTIVE", lastMoveTime: Date.now() }
                : prev
        )
    }, [])

    // Cleanup on unmount
    useEffect(() => () => clearTimers(), [clearTimers])

    return { safeWalkState: state, path, startWalk, stopWalk, simulateStop, resetAlert }
}
