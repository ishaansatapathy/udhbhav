/**
 * powerGridService.js
 * Crisis power interconnect — scarce MW, utility demand/minima, KPIs for PS relevance.
 */

const UTILITIES_BLUEPRINT = [
  {
    id: "grid_router",
    label: "Grid / transmission backbone",
    requestedMW: 120,
    minMW: 72,
    criticality: 0.92,
    shortCode: "GR",
    lat: 12.9716,
    lng: 77.5946,
    mandate: "Hold transmission stability, islanding rules, and export limits for interconnected utilities.",
    fleetBridge:
      "Publishes MW settlement to SOC; outage telemetry correlates with road-block penalties in allocator.",
  },
  {
    id: "hospital_cluster",
    label: "Hospital & critical care island",
    requestedMW: 95,
    minMW: 58,
    criticality: 0.98,
    shortCode: "HC",
    lat: 12.9354,
    lng: 77.5821,
    mandate: "Guarantee clinical island power for OR/ICU, blood bank, imaging, and casualty surge tents.",
    fleetBridge:
      "Surge intent delegated to `hospital` liaison units plus ambulances paired on miner / casualty events.",
  },
  {
    id: "water_wastewater",
    label: "Water pumping & lift stations",
    requestedMW: 68,
    minMW: 42,
    criticality: 0.82,
    shortCode: "WW",
    lat: 13.0232,
    lng: 77.5918,
    mandate: "Keep potable pumping, lift stations, and flood gates within safe hydraulic envelopes.",
    fleetBridge:
      "Field valves monitored remotely; responder routes may be blocked — allocator accounts for penalties.",
  },
  {
    id: "mine_life_support",
    label: "Mine ventilation & gas telemetry stack",
    requestedMW: 78,
    minMW: 52,
    criticality: 0.95,
    shortCode: "MV",
    lat: 12.9082,
    lng: 77.6819,
    mandate: "Sustain underground ventilation drives, sump pumps, and STM32↔LoRa gas sentinel uplinks.",
    fleetBridge:
      "Highest gas / collapse anomalies trigger ambulance+hospital pairing at scene (see miner dispatch).",
  },
  {
    id: "emergency_comms",
    label: "Emergency mesh / responder backhaul",
    requestedMW: 38,
    minMW: 22,
    criticality: 0.88,
    shortCode: "CM",
    lat: 12.992,
    lng: 77.558,
    mandate: "QoS carve-out for responder voice/data mesh and casualty tagging backhaul links.",
    fleetBridge:
      "Police & ambulance agents consume live allocation feed; blackout pressure caps mesh retries.",
  },
  {
    id: "ev_transport_corridor",
    label: "EV rescue & logistics chargers",
    requestedMW: 45,
    minMW: 18,
    criticality: 0.55,
    shortCode: "EV",
    lat: 12.9205,
    lng: 77.5478,
    mandate: "Buffer EV chargers for evacuation buses and covert logistics sleds outside sterile zones.",
    fleetBridge:
      "Cabs prioritized for benign mobility; withheld from miner-gas and women-SOS corridors by policy.",
  },
]

const NOMINAL_MW_BASE = 520
/** Soft floor — grid never modeled as literal zero MW in demo */
const AVAILABLE_FLOOR_RATIO = 0.22

let nominalMW = NOMINAL_MW_BASE

/** Secondary interconnect damage layering (survives a few ticks; compresses MW while incidents compound). */
let cascadeResidualStress = 0
let cascadeStrikeCount = 0

/**
 * Demand multipliers keyed by dominant crisis flavour (applied to mine / hospital bumps).
 */
function applyEventDemandMods(events, utils) {
  const active = events.filter(e => e.status !== "resolved")
  let mineBoost = 1
  let hospitalBoost = 1
  let gridStrain = 1
  for (const ev of active) {
    const t = ev.type || ""
    if (t === "mine_gas_lora" || t === "mine_collapse") mineBoost += 0.11 + ev.severity * 0.006
    if (t === "earthquake" || t === "flood" || t === "industrial_hazard") gridStrain += 0.045 + ev.severity * 0.004
    if (ev.casualties_est > 12 || t === "women_sos" || t === "chemical_leak") hospitalBoost += 0.04 + ev.severity * 0.003
  }
  return utils.map(u => {
    let rq = u.requestedMW
    let mn = u.minMW
    if (u.id === "mine_life_support") rq *= mineBoost
    if (u.id === "hospital_cluster") rq *= hospitalBoost
    if (u.id === "water_wastewater" && mineBoost > 1.05) rq *= 1.03
    if (u.id === "grid_router") rq *= gridStrain
    return {
      ...u,
      requestedMW: Number(rq.toFixed(1)),
      minMW: Number(Math.min(mn * (gridStrain > 1.08 ? 1.03 : 1), rq * 0.95).toFixed(1)),
    }
  })
}

function aggregateStress(events) {
  let s = 0
  for (const ev of events) {
    if (ev.status === "resolved") continue
    const w = ev.type === "earthquake" ? 1.25 : ev.type === "women_sos" ? 1.15 : ev.type === "mine_gas_lora" ? 1.2 : 1.0
    s += Math.pow(ev.severity, 1.25) * w
  }
  return s
}

function decayCascadeLayer() {
  if (cascadeResidualStress <= 0.004) cascadeResidualStress = 0
  else cascadeResidualStress = Number((cascadeResidualStress * 0.987 - 0.015).toFixed(3))
}

/**
 * Physical damage modeled on tie-lines beyond live incident KPIs alone.
 * @param {number} [stressAdditive] Stress-equivalent units (~18–38 typical per strike).
 */
function triggerCascadeShock(stressAdditive) {
  const bump =
    typeof stressAdditive === "number" && Number.isFinite(stressAdditive)
      ? stressAdditive
      : 21 + Math.random() * 12
  cascadeResidualStress = Number(Math.min(92, cascadeResidualStress + bump).toFixed(2))
  cascadeStrikeCount++
  return { cascadeResidualStress, cascadeStrikeCount }
}

/**
 * Operational posture for stakeholder “utility agents” surfaced to clients.
 */
function deriveStakeholderStatus(u, blackoutRiskPct) {
  if (u.allocatedMW + 0.045 < u.minMW) return "mandate_breach"
  const ratio = u.requestedMW > 0 ? u.shortfallMW / u.requestedMW : 0
  if (ratio > 0.14) return "load_shedding"
  if (ratio > 0.04 || (blackoutRiskPct > 30 && u.criticality >= 0.94)) return "stressed"
  return "nominal"
}

function stakeholderObjective(utilityId, activeEvents, blackoutRiskPct) {
  const types = new Set(activeEvents.map(e => e.type))
  const heavyCasualty = activeEvents.some(e => (e.casualties_est ?? 0) > 14)
  switch (utilityId) {
    case "grid_router":
      return types.has("earthquake") || types.has("flood") || types.has("industrial_hazard")
        ? "Wide-area transmission derated — managing stability reserves versus utility asks."
        : "Holding interconnect headroom; moderates bids before fleet dispatch deltas."
    case "hospital_cluster":
      return types.has("women_sos") || types.has("chemical_leak") || heavyCasualty
        ? "Clinical surge stance: casualty staging dominates MW and fleet pairing decisions."
        : "Deferring elective load; aligning with interconnect settlement each tick."
    case "water_wastewater":
      return types.has("flood") || types.has("earthquake")
        ? "Hydraulic risk — lift stations and flood gates prioritized under strain."
        : "Serving baseline municipal pumping; trims follow EV corridor posture when tight."
    case "mine_life_support":
      return types.has("mine_gas_lora") || types.has("mine_collapse")
        ? "Underground stacks at duty cycle max; LoRa sentinel uplinks classed mission-critical."
        : "Ventilation housekeeping; ready to spike on next gas or collapse anomaly."
    case "emergency_comms":
      return activeEvents.length > 5
        ? "High contention window — guarding mesh backhaul QoS versus sheddable chargers."
        : "Backhaul pacing normal; blackout pressure drives retry throttles downstream."
    case "ev_transport_corridor":
      return activeEvents.some(e => e.type === "women_sos" || e.priority === "CRITICAL") ||
        blackoutRiskPct > 40
        ? "Load flexible — chargers yield first so clinical + mine life-support stay firm."
        : "Logistics chargers opportunistic — surplus MW only after contractual floors served."
    default:
      return "Coordinating with interconnect moderator settlement."
  }
}

function allocateAcrossUtilities(utils, availableMW) {
  const sumRequested = utils.reduce((a, u) => a + u.requestedMW, 0)
  const sumMin = utils.reduce((a, u) => a + u.minMW, 0)

  const rows = utils.map(u => ({
    id: u.id,
    label: u.label,
    shortCode: u.shortCode,
    lat: u.lat,
    lng: u.lng,
    mandate: u.mandate,
    fleetBridge: u.fleetBridge,
    requestedMW: u.requestedMW,
    minMW: u.minMW,
    criticality: u.criticality,
    allocatedMW: 0,
    shortfallMW: 0,
  }))

  let rem = availableMW

  /** Cannot meet all contractual mins — proportional ration on min MW */
  if (availableMW <= sumMin + 1e-6 && sumMin > 0) {
    for (const r of rows) {
      r.allocatedMW = Number(((availableMW * r.minMW) / sumMin).toFixed(2))
    }
  } else {
    for (const r of rows) {
      const g = Number(Math.min(r.minMW, rem).toFixed(2))
      r.allocatedMW = g
      rem -= g
    }
    if (rem > 0.005) {
      const weighted = rows.map(r => ({
        r,
        room: Math.max(0, r.requestedMW - r.allocatedMW),
        w: r.criticality * Math.max(0.05, r.requestedMW - r.minMW),
      }))
      let wSum = weighted.reduce((a, h) => a + (h.room > 0 ? h.w : 0), 0)
      for (const h of weighted) {
        if (h.room <= 0 || wSum <= 0) continue
        const add = Number(Math.min(h.room, (h.w / wSum) * rem).toFixed(2))
        h.r.allocatedMW += add
      }
      /** Second pass clears rounding slack */
      let serve = rows.reduce((a, r) => a + r.allocatedMW, 0)
      let slack = Number(Math.max(0, availableMW - serve).toFixed(4))
      if (slack > 0.01) {
        for (const r of [...rows].sort((a, b) => b.criticality - a.criticality)) {
          const room = Math.max(0, r.requestedMW - r.allocatedMW)
          const add = Math.min(room, slack)
          r.allocatedMW = Number((r.allocatedMW + add).toFixed(2))
          slack -= add
          if (slack <= 1e-4) break
        }
      }
    }
  }

  for (const r of rows) {
    /** Hard cap cannot exceed requested */
    r.allocatedMW = Number(Math.min(r.requestedMW, r.allocatedMW).toFixed(2))
    r.shortfallMW = Number(Math.max(0, r.requestedMW - r.allocatedMW).toFixed(2))
  }

  const servedMW = rows.reduce((a, u) => a + u.allocatedMW, 0)
  const unservedMW = Number(Math.max(0, sumRequested - servedMW).toFixed(2))
  const blackoutRiskPct =
    sumMin <= 0 ? 0 : Number((Math.min(100, Math.max(0, ((sumMin - availableMW) / sumMin) * 100))).toFixed(1))

  return {
    utilities: rows,
    sumRequested: Number(sumRequested.toFixed(1)),
    sumMin: Number(sumMin.toFixed(1)),
    servedMW: Number(servedMW.toFixed(2)),
    unservedMW,
    blackoutRiskPct,
    loadPctOfCapacity: nominalMW > 0 ? Number(((sumRequested / nominalMW) * 100).toFixed(1)) : 0,
  }
}

function buildSnapshot(events) {
  decayCascadeLayer()
  let adjusted = UTILITIES_BLUEPRINT.map(u => ({ ...u }))
  adjusted = applyEventDemandMods(events, adjusted)

  const baseStressRaw = aggregateStress(events)
  const stress = Number((baseStressRaw + cascadeResidualStress * 1.12).toFixed(3))
  const derate = Math.min(0.82, stress / 95)
  const availableMW = Number(
    (nominalMW * Math.max(AVAILABLE_FLOOR_RATIO, 1 - derate)).toFixed(2)
  )

  const allocation = allocateAcrossUtilities(adjusted, availableMW)

  const activeEv = events.filter(e => e.status !== "resolved")
  const stakeholderAgents = allocation.utilities.map(u => {
    const status = deriveStakeholderStatus(u, allocation.blackoutRiskPct)
    return {
      id: `stk_${u.id}`,
      utilityId: u.id,
      label: u.label,
      shortCode: u.shortCode,
      lat: Number(u.lat),
      lng: Number(u.lng),
      mandate: u.mandate,
      fleetBridge: u.fleetBridge,
      requestedMW: u.requestedMW,
      minMW: u.minMW,
      criticality: u.criticality,
      allocatedMW: u.allocatedMW,
      shortfallMW: u.shortfallMW,
      status,
      objective: stakeholderObjective(u.id, activeEv, allocation.blackoutRiskPct),
    }
  })

  return {
    nominalMW: Number(nominalMW.toFixed(1)),
    availableMW,
    stressIndex: Number(stress.toFixed(2)),
    baseStressIndex: Number(baseStressRaw.toFixed(2)),
    cascadeStrikeCount,
    cascadeResidualStress: Number(cascadeResidualStress.toFixed(2)),
    cascadeActive: cascadeResidualStress > 0.12,
    derateFactor: Number((1 - derate).toFixed(3)),
    updatedAt: Date.now(),
    stakeholderAgents,
    ...allocation,
  }
}

function reset() {
  nominalMW = NOMINAL_MW_BASE
  cascadeResidualStress = 0
  cascadeStrikeCount = 0
}

module.exports = {
  reset,
  buildSnapshot,
  triggerCascadeShock,
  UTILITIES_BLUEPRINT,
}
