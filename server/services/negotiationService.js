/**
 * Multi-round MW negotiation transcript — aligns with crisis power ledger.
 * Generates readable bid → grid counter-offer → revise → finalize prose for judges.
 */

const MAX_LINES = 320

/** @type {string} */
let lastSignature = ""

/** @type {{ id: string, ts: number, sessionId: string, round: number, phase: string, speaker: string, body: string }[]} */
let lines = []

function signatureFromSnapshot(snap) {
  return [
    snap.availableMW.toFixed(1),
    snap.unservedMW.toFixed(1),
    snap.blackoutRiskPct.toFixed(1),
    snap.stressIndex.toFixed(2),
    String(snap.cascadeResidualStress ?? 0),
    String(snap.cascadeStrikeCount ?? 0),
    ...snap.utilities.map(u => `${u.id}:${u.allocatedMW.toFixed(1)}:${u.shortfallMW.toFixed(1)}`),
  ].join("|")
}

function incidentBrief(events) {
  const open = events.filter(e => e.status !== "resolved")
  if (!open.length) return "No open incidents — operating under nominal contingency posture."
  const types = [...new Set(open.map(e => String(e.type).replace(/_/g, " ")))].slice(0, 5)
  const crit = open.filter(e => e.priority === "CRITICAL").length
  const tail =
    crit > 0 ? ` ${crit} marked CRITICAL; clinical and life-support corridors remain preemptible.`
    : ""
  return `${open.length} live incident envelope(s): ${types.join(", ")}.${tail}`
}

/** @param {{ label: string, requestedMW: number, minMW: number, allocatedMW: number, shortfallMW: number, criticality: number }[]} utils */
function topCriticalLabels(utils, n = 4) {
  return [...utils]
    .sort((a, b) => b.criticality - a.criticality || b.shortfallMW - a.shortfallMW)
    .slice(0, n)
    .map(u => u.label.split("&")[0].trim())
}

function compileSession(events, snap) {
  const rows = []

  rows.push({
    round: 0,
    phase: "open",
    speaker: "Interconnect moderator",
    body: `Opening negotiation window (${new Date(snap.updatedAt || Date.now()).toLocaleTimeString()}) · ${incidentBrief(events)}`,
  })

  if ((snap.cascadeResidualStress ?? 0) > 0.08) {
    const baseIdx = typeof snap.baseStressIndex === "number" ? snap.baseStressIndex : snap.stressIndex
    rows.push({
      round: 0,
      phase: "cascade",
      speaker: "Contingency stack",
      body:
        `Secondary interconnect damage ACTIVE — cascading layer +${(snap.cascadeResidualStress ?? 0).toFixed(
          1,
        )} stress-eq (strike wave #${snap.cascadeStrikeCount ?? 0}). ` +
        `Incident-only index ${baseIdx.toFixed(2)} vs composite ${snap.stressIndex.toFixed(
          2,
        )} — shed EV/logistics trims before hardened floors.`,
    })
  }

  rows.push({
    round: 1,
    phase: "call",
    speaker: "Grid operator",
    body: `Round 1 — utilities lodge MW targets referencing contractual mins. Feasibility envelope trending ${snap.availableMW.toFixed(1)} MW export / ${snap.nominalMW.toFixed(0)} MW nominal (stress ${snap.stressIndex.toFixed(2)}).`,
  })

  for (const u of snap.utilities) {
    rows.push({
      round: 1,
      phase: "bid",
      speaker: u.label.split(" — ")[0].slice(0, 52),
      body: `Bids ${u.requestedMW.toFixed(1)} MW with ${u.minMW.toFixed(1)} MW hard minimum; cites criticality ${(u.criticality * 100).toFixed(0)}¢.`,
    })
  }

  const ordered = [...snap.utilities].sort((a, b) => b.criticality - a.criticality)
  const prio = ordered
    .filter(u => u.shortfallMW > 0.05)
    .slice(0, 3)
    .map(u => `${u.label.split("&")[0].trim()} −${u.shortfallMW.toFixed(1)} MW`)
  const shortfallHint =
    prio.length > 0
      ? ` Non-firm loads likely curtailed first: ${prio.join("; ")}.`
      : " All contractual floors appear serviceable — surplus contested by criticality weighting."

  rows.push({
    round: 2,
    phase: "counter",
    speaker: "Grid operator",
    body: `Round 2 counter-offer · ceiling ${snap.availableMW.toFixed(1)} MW. Aggregate ask ${snap.sumRequested.toFixed(1)} MW vs served path ${snap.servedMW.toFixed(1)} MW; blackout-pressure index ${snap.blackoutRiskPct.toFixed(1)}%.${shortfallHint}`,
  })

  rows.push({
    round: 2,
    phase: "counter",
    speaker: "Grid operator",
    body: `Provisional policy: honour mins where physically possible, ration residual by criticality × headroom.${snap.unservedMW > 0.35 ? ` Projected aggregate gap ${snap.unservedMW.toFixed(1)} MW — escalate EV corridor / logistics deferrals.` : " No systemic gap projected at this timestep."}`,
  })

  rows.push({
    round: 3,
    phase: "revise",
    speaker: "Load dispatch consortium",
    body:
      snap.unservedMW > 0.55
        ? `Round 3 — stakeholders accept trims; waive nonclinical headroom until gap < ${(snap.unservedMW * 0.72).toFixed(1)} MW equivalent.`
        : "Round 3 — stakeholders accept operator math; no formal objection recorded on firm minima.",
  })

  const leaders = topCriticalLabels(snap.utilities, 3).join(" · ")
  rows.push({
    round: 3,
    phase: "revise",
    speaker: "Hospital & mine liaisons",
    body: `Priority acknowledgement path: ${leaders} maintain first claim on incremental MW until clinical + ventilation floors are locked.`,
  })

  rows.push({
    round: 3,
    phase: "finalize",
    speaker: "Grid operator",
    body: `FINAL — executing dispatch table: Σ allocated ${snap.servedMW.toFixed(1)} MW · unserved ${snap.unservedMW.toFixed(1)} MW · load ${snap.loadPctOfCapacity.toFixed(1)}% of nominal envelope.`,
  })

  for (const u of snap.utilities) {
    const tag = u.shortfallMW > 0.05 ? `shortfall ${u.shortfallMW.toFixed(1)} MW` : "fully served at requested cap"
    rows.push({
      round: 3,
      phase: "finalize",
      speaker: u.label.split(" — ")[0].slice(0, 48),
      body: `Locked ${u.allocatedMW.toFixed(1)} / ${u.requestedMW.toFixed(1)} MW · ${tag}.`,
    })
  }

  return rows
}

/**
 * @returns {{ lines: typeof lines, updatedAt: number } | null}
 */
function syncFromSnapshot(events, snap) {
  const sig = signatureFromSnapshot(snap)
  if (sig === lastSignature) return null
  lastSignature = sig

  const sessionId = `sess_${snap.updatedAt || Date.now()}`
  const compiled = compileSession(events, snap)
  const stamp = Date.now()

  const newLines = compiled.map((row, idx) => ({
    id: `${sessionId}_${idx}`,
    ts: stamp,
    sessionId,
    round: row.round,
    phase: row.phase,
    speaker: row.speaker,
    body: row.body,
  }))

  lines = [...newLines, ...lines].slice(0, MAX_LINES)
  return { lines: lines.slice(), updatedAt: stamp }
}

function reset() {
  lastSignature = ""
  lines = []
}

function getState() {
  return { lines: lines.slice(), updatedAt: lines[0]?.ts ?? Date.now() }
}

module.exports = {
  reset,
  syncFromSnapshot,
  getState,
}
