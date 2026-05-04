/**
 * useSmartAlert — proactive alert system that fires BEFORE SOS.
 *
 * Triggers:
 *  - DEVIATION   → cab route deviation detected
 *  - STOP        → Safe Walk stop detection
 *  - HIGH_RISK_ZONE → entering a high-risk area
 *
 * Once triggered, alert stays visible until user explicitly dismisses
 * or triggers SOS. Will NOT re-trigger for the same event until reset.
 */

import { useState, useCallback, useRef } from "react"

export type SmartAlertTrigger = "DEVIATION" | "STOP" | "HIGH_RISK_ZONE"

export interface SmartAlertState {
    visible: boolean
    triggeredBy: SmartAlertTrigger | null
}

const IDLE: SmartAlertState = { visible: false, triggeredBy: null }

const MESSAGES: Record<SmartAlertTrigger, string> = {
    DEVIATION: "You are off the expected route.",
    STOP: "You have been stationary for a while.",
    HIGH_RISK_ZONE: "You are entering a high-risk area.",
}

export function useSmartAlert() {
    const [alertState, setAlertState] = useState<SmartAlertState>(IDLE)

    // Prevents re-triggering the same event type until fully reset
    const lastTriggerRef = useRef<SmartAlertTrigger | null>(null)

    const triggerAlert = useCallback((reason: SmartAlertTrigger) => {
        // Don't spam — skip if already showing or same trigger hasn't been reset
        if (lastTriggerRef.current === reason) return
        lastTriggerRef.current = reason
        setAlertState({ visible: true, triggeredBy: reason })
    }, [])

    /** User pressed "I'm Safe" */
    const dismiss = useCallback(() => {
        lastTriggerRef.current = null
        setAlertState(IDLE)
    }, [])

    /** User pressed "Need Help" → caller should trigger SOS after this */
    const escalate = useCallback(() => {
        lastTriggerRef.current = null
        setAlertState(IDLE)
    }, [])

    return { alertState, triggerAlert, dismiss, escalate, MESSAGES }
}
