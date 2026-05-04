/**
 * generateIncidentText — Rule-based "AI-style" incident explanation.
 *
 * Converts system event flags into a human-readable summary sentence.
 * No actual AI — just smart string construction for demo purposes.
 */

export interface IncidentEvents {
  deviation: boolean
  stopped: boolean
  zone: "HIGH" | "MEDIUM" | "LOW" | null
  nightTime: boolean
}

export function generateIncidentText(events: IncidentEvents): string {
  const parts: string[] = []
  const context: string[] = []

  // ── Primary action ──
  if (events.deviation && events.stopped) {
    parts.push("Vehicle deviated from the expected route and remained stationary")
  } else if (events.deviation) {
    parts.push("Vehicle deviated from the expected route")
  } else if (events.stopped) {
    parts.push("Vehicle stopped unexpectedly and has been stationary")
  }

  // ── Zone context ──
  if (events.zone === "HIGH") {
    context.push("in a high-risk area")
  } else if (events.zone === "MEDIUM") {
    context.push("in a moderate-risk area")
  } else if (events.zone === "LOW") {
    context.push("in a low-risk area")
  }

  // ── Time context ──
  if (events.nightTime) {
    context.push("during late-night hours")
  }

  // ── Nothing detected ──
  if (parts.length === 0 && context.length === 0) {
    return ""
  }

  // ── Zone-only scenario (no deviation/stop) ──
  if (parts.length === 0 && context.length > 0) {
    if (events.zone === "HIGH") {
      parts.push("Vehicle is currently operating")
    } else {
      parts.push("Vehicle is being monitored")
    }
  }

  // ── Compose ──
  let sentence = parts.join(". ")
  if (context.length > 0) {
    sentence += " " + context.join(" and ")
  }
  sentence += "."

  // ── Severity suffix ──
  const severityCount = [events.deviation, events.stopped, events.zone === "HIGH", events.nightTime].filter(Boolean).length
  if (severityCount >= 3) {
    sentence += " Immediate attention recommended — multiple risk factors detected."
  } else if (severityCount === 2) {
    sentence += " Elevated risk — monitoring closely."
  }

  return sentence
}
