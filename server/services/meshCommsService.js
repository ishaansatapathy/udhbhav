/**
 * Lightweight mesh-style comms feed for demo narration.
 * Emits short operator/utility lines when power posture or allocations shift.
 */

const MAX_MESSAGES = 220

/** @type {string} */
let lastSnapshotSig = ""

/** @type {{id:string;ts:number;speaker:string;role:string;channel:string;body:string}[]} */
let messages = []

function pushMessage(msg) {
  messages = [msg, ...messages].slice(0, MAX_MESSAGES)
}

function mk(speaker, role, channel, body) {
  return {
    id: `mesh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    speaker,
    role,
    channel,
    body,
  }
}

function snapshotSig(snap) {
  return [
    snap.availableMW.toFixed(1),
    snap.unservedMW.toFixed(1),
    snap.blackoutRiskPct.toFixed(1),
    (snap.cascadeResidualStress ?? 0).toFixed(2),
    ...snap.utilities.map(u => `${u.id}:${u.allocatedMW.toFixed(1)}:${u.shortfallMW.toFixed(1)}`),
  ].join("|")
}

function utilityLead(utilities) {
  return [...utilities]
    .filter(u => u.shortfallMW > 0.05)
    .sort((a, b) => b.shortfallMW - a.shortfallMW)
    .slice(0, 2)
    .map(u => `${u.shortCode || u.id.toUpperCase()}: -${u.shortfallMW.toFixed(1)}MW`)
    .join(" · ")
}

function syncFromSnapshot(snap) {
  const sig = snapshotSig(snap)
  if (sig === lastSnapshotSig) return null
  lastSnapshotSig = sig

  const burst = []
  let gridBody = `Interconnect now ${snap.availableMW.toFixed(1)}MW (demand ${snap.sumRequested.toFixed(1)}MW, unserved ${snap.unservedMW.toFixed(1)}MW, blackout ${snap.blackoutRiskPct.toFixed(1)}%).`
  if (snap.cascadeActive) {
    gridBody += ` Cascade stack: +${(snap.cascadeResidualStress ?? 0).toFixed(1)} stress-eq, wave #${snap.cascadeStrikeCount ?? 0}; degraded mode · non-firm shed.`
  }
  burst.push(
    mk("Grid operator", "grid", snap.cascadeActive ? "cascade" : "power", gridBody)
  )

  const lead = utilityLead(snap.utilities)
  if (lead) {
    burst.push(
      mk(
        "Utility dispatch",
        "utility",
        "utility",
        `Load-shed focus ${lead}. Holding contractual minima before discretionary corridors.`
      )
    )
  }

  burst.forEach(pushMessage)
  return { messages: messages.slice(), updatedAt: Date.now() }
}

function noteAllocation(event, result) {
  if (!result?.agent?.id) return null
  const t = String(event?.type || "incident").replace(/_/g, " ")
  let body = `Dispatch commit: ${result.agent.id} → ${t} (${event?.id || "evt"}), score ${Number(result.score || 0).toFixed(2)}.`
  if (result.secondary?.id) {
    body += ` Paired staging: ${result.secondary.id} (Δ score ${((result.score || 1) * 0.97).toFixed(2)}).`
  }
  const msg = mk("CrisisOps", "operator", "allocation", body)
  pushMessage(msg)
  return msg
}

function noteFairnessGamma(gamma) {
  const g = Number(gamma)
  if (Number.isNaN(g)) return null
  const clamped = Math.min(1, Math.max(0, g))
  const msg = mk(
    "Policy desk",
    "system",
    "policy",
    `Allocator fairness γ → ${clamped.toFixed(2)}. Next dispatches re-weight idle spread vs greedy proximity.`
  )
  pushMessage(msg)
  return msg
}

function reset() {
  lastSnapshotSig = ""
  messages = []
  pushMessage(mk("Coordinator", "system", "system", "Mesh comms reset. Waiting for first settlement tick."))
}

function getState() {
  return { messages: messages.slice(), updatedAt: messages[0]?.ts ?? Date.now() }
}

module.exports = {
  syncFromSnapshot,
  noteAllocation,
  noteFairnessGamma,
  reset,
  getState,
}
