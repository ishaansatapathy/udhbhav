/**
 * useRiskScore — Dynamic safety score hook.
 *
 * Starts at 100 and decreases based on detected events.
 * Score is clamped to [0, 100]. Returns color based on current score.
 */

import { useState, useCallback, useRef } from "react"

export type RiskEvent = "DEVIATION" | "STOP" | "HIGH_RISK_ZONE" | "NIGHT_TIME"

const PENALTIES: Record<RiskEvent, number> = {
  DEVIATION: 30,
  STOP: 20,
  HIGH_RISK_ZONE: 25,
  NIGHT_TIME: 10,
}

export function useRiskScore() {
  const [riskScore, setRiskScore] = useState(100)

  // Track which events have been applied to prevent double-counting
  const appliedRef = useRef<Set<RiskEvent>>(new Set())

  const applyEvent = useCallback((event: RiskEvent) => {
    // Prevent same event from applying twice
    if (appliedRef.current.has(event)) return
    appliedRef.current.add(event)

    setRiskScore(prev => Math.max(0, Math.min(100, prev - PENALTIES[event])))
  }, [])

  const reset = useCallback(() => {
    appliedRef.current.clear()
    setRiskScore(100)
  }, [])

  const riskColor =
    riskScore >= 80 ? "#22c55e" :   // green
    riskScore >= 50 ? "#eab308" :    // yellow
                      "#ef4444"      // red

  const riskLabel =
    riskScore >= 80 ? "SAFE" :
    riskScore >= 50 ? "CAUTION" :
                      "DANGER"

  return { riskScore, riskColor, riskLabel, applyEvent, reset }
}
