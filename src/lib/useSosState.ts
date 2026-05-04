/**
 * useSosState — central SOS state machine hook.
 *
 * Manages the full lifecycle:
 *   IDLE → SEARCHING → ASSIGNED → ENROUTE → ARRIVED
 *
 * Exposes:
 *  - sosState        : current state snapshot
 *  - activateSOS()   : call this when user presses SOS
 *  - resetSOS()      : call to return to IDLE
 *  - updateResponderPos() : called each animation tick to track live coords
 */

import { useState, useRef, useCallback, useEffect } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

export type SosStatus = "IDLE" | "SEARCHING" | "ASSIGNED" | "ENROUTE" | "ARRIVED"

export interface ResponderInfo {
    id: string
    lat: number
    lng: number
}

export interface SosState {
    active: boolean
    status: SosStatus
    responder: ResponderInfo | null
    eta: number | null          // seconds
    distanceM: number | null
    escalated: boolean         // "Alert escalated to safety network" flag
}

// ── Haversine helper ──────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371000
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Random offset ~1.2 km away from user. */
function randomOffset() {
    const angle = Math.random() * Math.PI * 2
    const dist = 0.010 + Math.random() * 0.002
    return { dLat: Math.cos(angle) * dist, dLng: Math.sin(angle) * dist }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const IDLE_STATE: SosState = {
    active: false,
    status: "IDLE",
    responder: null,
    eta: null,
    distanceM: null,
    escalated: false,
}

export function useSosState(userLat: number, userLng: number) {
    const [sosState, setSosState] = useState<SosState>(IDLE_STATE)

    const t1Ref = useRef<ReturnType<typeof setTimeout> | null>(null)
    const t2Ref = useRef<ReturnType<typeof setTimeout> | null>(null)
    const escalationRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearAllTimers = useCallback(() => {
        if (t1Ref.current) { clearTimeout(t1Ref.current); t1Ref.current = null }
        if (t2Ref.current) { clearTimeout(t2Ref.current); t2Ref.current = null }
        if (escalationRef.current) { clearTimeout(escalationRef.current); escalationRef.current = null }
    }, [])

    const activateSOS = useCallback(() => {
        clearAllTimers()

        // Step 1 — SEARCHING
        setSosState({
            active: true,
            status: "SEARCHING",
            responder: null,
            eta: null,
            distanceM: null,
            escalated: false,
        })

        // Step 2 — ASSIGNED (after 2 s)
        t1Ref.current = setTimeout(() => {
            const off = randomOffset()
            const responder: ResponderInfo = {
                id: "Responder-01",
                lat: userLat + off.dLat,
                lng: userLng + off.dLng,
            }
            const distM = haversineM(responder.lat, responder.lng, userLat, userLng)
            const eta = Math.round(distM / 4.5) // walking speed ~4.5 m/s

            setSosState(prev => ({
                ...prev,
                status: "ASSIGNED",
                responder,
                eta,
                distanceM: Math.round(distM),
            }))

            // Step 3 — ENROUTE (after another 2 s)
            t2Ref.current = setTimeout(() => {
                setSosState(prev => ({ ...prev, status: "ENROUTE" }))
            }, 2000)
        }, 2000)

        // Escalation message after 5 s
        escalationRef.current = setTimeout(() => {
            setSosState(prev => prev.active ? { ...prev, escalated: true } : prev)
        }, 5000)
    }, [userLat, userLng, clearAllTimers])

    /** Called each animation tick from LiveResponseSimulation to sync live distance/ETA. */
    const updateResponderPos = useCallback((lat: number, lng: number, arrived: boolean) => {
        if (arrived) {
            setSosState(prev => prev.active ? {
                ...prev,
                status: "ARRIVED",
                eta: 0,
                distanceM: 0,
            } : prev)
        } else {
            const distM = haversineM(lat, lng, userLat, userLng)
            setSosState(prev => prev.active && prev.status === "ENROUTE" ? {
                ...prev,
                distanceM: Math.round(distM),
                eta: Math.round(distM / 4.5),
            } : prev)
        }
    }, [userLat, userLng])

    const resetSOS = useCallback(() => {
        clearAllTimers()
        setSosState(IDLE_STATE)
    }, [clearAllTimers])

    // Cleanup on unmount
    useEffect(() => () => clearAllTimers(), [clearAllTimers])

    return { sosState, activateSOS, resetSOS, updateResponderPos }
}
