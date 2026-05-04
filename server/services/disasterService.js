/**
 * disasterService.js - Event queue, road constraints, crime zones, re-allocation
 */

const agentEngine = require("./agentEngine")
const fairnessService = require("./fairnessService")
const powerGridService = require("./powerGridService")
const fs = require("fs")
const path = require("path")

let events = []
let eventIdCounter = 1

const BLR = { minLat: 12.78, maxLat: 13.14, minLng: 77.45, maxLng: 77.85 }
function randLat() { return BLR.minLat + Math.random() * (BLR.maxLat - BLR.minLat) }
function randLng() { return BLR.minLng + Math.random() * (BLR.maxLng - BLR.minLng) }

// ── Road constraints ──────────────────────────────────────────────────────────
let blockedRoadZones = []

function loadRoadConstraints() {
  try {
    const csvPath = path.resolve(__dirname, "../../model/indian_roads_dataset.csv")
    if (!fs.existsSync(csvPath)) { console.warn("[ROADS] CSV not found"); return }
    const lines = fs.readFileSync(csvPath, "utf8").split("\n").slice(1)
    let loaded = 0
    const step = Math.max(1, Math.floor(lines.length / 20))
    for (let i = 0; i < lines.length && loaded < 20; i += step) {
      const parts = lines[i]?.split(",")
      if (!parts || parts.length < 3) continue
      const roadLength = parseFloat(parts[2]) || 0
      if (roadLength > 50) {
        blockedRoadZones.push({
          lat: randLat(), lng: randLng(),
          radius_km: 1.5,
          penalty_multiplier: Math.min(2.5, 1 + roadLength / 200),
          road_name: (parts[1] || "Unknown").trim(),
        })
        loaded++
      }
    }
    console.log(`[ROADS] ${loaded} road constraint zones loaded`)
  } catch (e) { console.error("[ROADS] Load error:", e.message) }
}

function getEffectiveDistance(fromLat, fromLng, toLat, toLng) {
  const base = agentEngine.haversine(fromLat, fromLng, toLat, toLng)
  let penalty = 1.0
  let blockedRoad = null
  for (const zone of blockedRoadZones) {
    const d = agentEngine.haversine(fromLat, fromLng, zone.lat, zone.lng)
    if (d < zone.radius_km && zone.penalty_multiplier > penalty) {
      penalty = zone.penalty_multiplier
      blockedRoad = zone.road_name
    }
  }
  return { distance: base * penalty, penalty, isBlocked: penalty > 1.5, blockedRoad }
}

// ── Crime zones for SOS hotspots ──────────────────────────────────────────────
const HIGH_CRIME_ZONES = []

function loadCrimeZones() {
  try {
    const csvPath = path.resolve(__dirname, "../../model/crime_dataset_india.csv")
    if (!fs.existsSync(csvPath)) return
    const lines = fs.readFileSync(csvPath, "utf8").split("\n").slice(1)
    const CITY_MAP = {
      "bangalore": [12.9716, 77.5946], "bengaluru": [12.9716, 77.5946],
      "mysore": [12.2958, 76.6394], "hubli": [15.3647, 75.1240],
      "delhi": [28.6139, 77.2090], "mumbai": [19.0760, 72.8777],
    }
    let loaded = 0
    for (const line of lines.slice(0, 300)) {
      if (!line.trim() || loaded >= 15) break
      const parts = line.split(",")
      const city = (parts[1] || "").toLowerCase().trim()
      for (const [key, coords] of Object.entries(CITY_MAP)) {
        if (city.includes(key)) {
          HIGH_CRIME_ZONES.push({
            lat: coords[0] + (Math.random() - 0.5) * 0.08,
            lng: coords[1] + (Math.random() - 0.5) * 0.08,
          })
          loaded++
          break
        }
      }
    }
    if (HIGH_CRIME_ZONES.length < 5) {
      [[12.9716,77.5946],[12.9352,77.6245],[12.9010,77.6069],[13.0120,77.5520],[12.8500,77.6500]]
        .forEach(([lat,lng]) => HIGH_CRIME_ZONES.push({ lat, lng }))
    }
    console.log(`[CRIME] ${HIGH_CRIME_ZONES.length} crime hotspot zones loaded`)
  } catch (e) { console.error("[CRIME] Load error:", e.message) }
}

function getCrimeBasedSosLocation() {
  if (HIGH_CRIME_ZONES.length > 0) {
    const z = HIGH_CRIME_ZONES[Math.floor(Math.random() * HIGH_CRIME_ZONES.length)]
    return { lat: z.lat + (Math.random() - 0.5) * 0.02, lng: z.lng + (Math.random() - 0.5) * 0.02 }
  }
  return { lat: randLat(), lng: randLng() }
}

// ── Event templates ───────────────────────────────────────────────────────────
const EVENT_TEMPLATES = {
  flood:            { descriptions: ["Heavy flooding in residential area","River overflow blocking emergency routes","Flash flood warning — multiple zones affected"], baseSeverity:7, baseCasualties:15 },
  earthquake:       { descriptions: ["Building collapse — people trapped","Seismic damage widespread","Gas pipeline rupture post-tremor"], baseSeverity:9, baseCasualties:40 },
  fire:             { descriptions: ["Urban fire outbreak in dense market","Warehouse blaze spreading rapidly","Wildfire edge approaching settlements"], baseSeverity:8, baseCasualties:18 },
  chemical_leak:    { descriptions: ["Chemical plant toxic gas leak","Hazmat evacuation in progress","Industrial spill near residential zone"], baseSeverity:8, baseCasualties:20 },
  mine_collapse:    { descriptions: ["Underground mine collapse — workers trapped","Tunnel cave-in — rescue requested","Mining site accident"], baseSeverity:8, baseCasualties:25 },
  mine_gas_lora:   { descriptions: [
    "LoRa-linked STM32 node: methane (CH₄) spike in egress shaft — anomaly vs baseline",
    "Underground gas trend + stalled ventilation telemetry — wearable health mesh tripped standby",
    "Mining belt VOC cluster + CO ppm rise from mesh relay — preemptive responder dispatch",
  ], baseSeverity: 9, baseCasualties: 22 },
  women_sos:        { descriptions: ["SOS from distressed woman","Emergency SOS — cab route deviation","Women safety alert — location tracked"], baseSeverity:10, baseCasualties:1 },
  industrial_hazard:{ descriptions: ["Factory explosion reported","Power plant malfunction — evacuation ordered","Boiler explosion at facility"], baseSeverity:7, baseCasualties:12 },
}

const SYNTHETIC_EVENTS = [
  { type:"flood",            lat:12.9716, lng:77.5946, severity:8 },
  { type:"flood",            lat:12.8500, lng:77.6500, severity:7 },
  { type:"earthquake",       lat:13.0358, lng:77.5970, severity:9 },
  { type:"fire",             lat:12.9650, lng:77.6050, severity:8 },
  { type:"earthquake",       lat:12.9010, lng:77.6069, severity:8 },
  { type:"chemical_leak",    lat:12.9855, lng:77.7480, severity:8 },
  { type:"chemical_leak",    lat:12.9300, lng:77.5500, severity:7 },
  { type:"mine_gas_lora",  lat:12.9820, lng:77.6820, severity:9 },
  { type:"mine_collapse",    lat:13.0550, lng:77.6500, severity:8 },
  { type:"mine_collapse",    lat:12.9352, lng:77.6245, severity:9 },
]

// Mining / gas / hazmat: ambulance → scene + hospital (MCI surge staging)
const DUAL_MEDICAL_EVENT_TYPES = new Set(["mine_gas_lora", "mine_collapse", "chemical_leak"])

function applyPrimaryAllocation(event, result) {
  event.assigned_agent = result.agent.id
  event.status = "responding"
  event.allocation_score = result.score
  event.road_penalty = result.road_penalty || 1.0
  event.allocation_explain = result.candidates || []
}

// ── Create event ──────────────────────────────────────────────────────────────
function createEvent({ type, lat, lng, severity, source = "manual" }) {
  const tmpl = EVENT_TEMPLATES[type] || EVENT_TEMPLATES.flood
  const sev = Math.min(10, Math.max(1, severity || tmpl.baseSeverity))
  const prio =
    type === "women_sos" || type === "mine_gas_lora" ? "CRITICAL"
      : type === "chemical_leak" && sev >= 8 ? "CRITICAL"
      : sev >= 8 ? "HIGH" : sev >= 5 ? "MEDIUM" : "LOW"
  const id = `evt_${eventIdCounter++}`
  const event = {
    id, type, severity: sev,
    casualties_est: Math.floor(tmpl.baseCasualties * (sev / 10) * (0.8 + Math.random() * 0.4)),
    lat: lat || randLat(), lng: lng || randLng(),
    description: tmpl.descriptions[Math.floor(Math.random() * tmpl.descriptions.length)],
    priority: prio,
    status: "active", source, timestamp: Date.now(),
    assigned_agent: null, road_penalty: 1.0,
    secondary_assignments: [],
  }
  if (type === "mine_gas_lora") {
    const gasPick = () => (["CH₄ > 1.2% LEL", "CO 88 ppm", "VOC index +41%", "O₂ drawdown 1.4%", "Baro delta — shaft ingress"])[Math.floor(Math.random() * 5)]
    event.sensor_meta = {
      hardware: "STM32 edge node · LoRa (e.g. SX1276) mesh to surface gateway",
      tunnel_node: `TUNNEL-NODE-${String(id).slice(-4)}`,
      readings: [gasPick(), gasPick()].filter((v, i, a) => a.indexOf(v) === i),
      gateway_ack: "GW-BLR-07 · UL_frame_ok",
    }
  } else if (type === "chemical_leak") {
    const toxPick = () =>
      ([
        "H₂S surrogate > TLV",
        "Chlorine photometric peak",
        "VOC cascade (PID)",
        "CO₂ buildup plume model",
        "Fixed gas IR — alkane anomaly",
      ])[Math.floor(Math.random() * 5)]
    event.sensor_meta = {
      hardware: "Plant ICS / Edge · fixed gas & weather head (Ethernet + 4–20 mA)",
      tunnel_node: `HAZMAT-RACK-${String(id).slice(-4)}`,
      readings: [toxPick(), toxPick()].filter((v, i, a) => a.indexOf(v) === i),
      gateway_ack: "DCS‑BLR‑03 · sensor_ok",
    }
  }
  events.push(event)
  console.log(`[DISASTER] ${event.id} type=${type} sev=${sev}`)
  return event
}

// ── Trigger disaster ──────────────────────────────────────────────────────────
function triggerDisaster(type) {
  const count = type === "earthquake" ? 3 : 2
  return Array.from({ length: count }, () => {
    const sev = EVENT_TEMPLATES[type]?.baseSeverity || 7
    let loc
    if (type === "women_sos") loc = getCrimeBasedSosLocation()
    else if (type === "mine_gas_lora" || type === "mine_collapse") {
      loc = { lat: 12.97 + Math.random() * 0.09, lng: 77.58 + Math.random() * 0.12 }
    } else if (type === "chemical_leak") {
      loc = { lat: 12.96 + Math.random() * 0.05, lng: 77.62 + Math.random() * 0.11 }
    } else loc = { lat: randLat(), lng: randLng() }
    return createEvent({ type, ...loc, severity: sev + Math.floor(Math.random() * 2 - 1), source: "simulation" })
  })
}

function fairnessCtxSnapshot() {
  return { fairnessGamma: fairnessService.getFairnessGamma(), activeEvents: [...events] }
}

// ── Allocate with road-constraint-aware distance ──────────────────────────────
function allocateToEvent(event) {
  if (DUAL_MEDICAL_EVENT_TYPES.has(event.type)) {
    const exclude = new Set()
    let primary = agentEngine.allocateAgent(
      event,
      getEffectiveDistance,
      { allowedTypes: ["ambulance"], excludedIds: exclude },
      fairnessCtxSnapshot()
    )
    if (!primary) primary = agentEngine.allocateAgent(event, getEffectiveDistance, null, fairnessCtxSnapshot())
    if (!primary) return null
    exclude.add(primary.agent.id)

    let secondary = agentEngine.allocateAgent(
      event,
      getEffectiveDistance,
      { allowedTypes: ["hospital"], excludedIds: exclude },
      fairnessCtxSnapshot()
    )
    if (!secondary) {
      secondary = agentEngine.allocateAgent(
        event,
        getEffectiveDistance,
        { allowedTypes: ["ambulance"], excludedIds: exclude },
        fairnessCtxSnapshot()
      )
    }

    applyPrimaryAllocation(event, primary)
    event.secondary_assignments = []
    if (secondary) {
      event.secondary_assignments.push({
        agentId: secondary.agent.id,
        type: secondary.agent.type,
        role:
          secondary.agent.type === "hospital"
            ? event.type === "chemical_leak"
              ? "Hospital / hazmat intake — surge beds & tox triage"
              : "Hospital / MCI intake — beds & tox triage"
            : "Backup ambulance corridor",
        score: secondary.score,
      })
    }
    console.log(`[DISASTER] Dual dispatch ${event.id}: ${primary.agent.id} + ${secondary ? secondary.agent.id : "none"}`)
    return { agent: primary.agent, secondary: secondary ? secondary.agent : null, score: primary.score, candidates: primary.candidates }
  }

  const result = agentEngine.allocateAgent(event, getEffectiveDistance, null, fairnessCtxSnapshot())
  if (!result) return null
  applyPrimaryAllocation(event, result)
  event.secondary_assignments = []
  return result
}

function triggerCrisisScenario() {
  const wave = [
    { type: "flood", count: 2 },
    { type: "earthquake", count: 2 },
    { type: "fire", count: 2 },
    { type: "chemical_leak", count: 1 },
    { type: "mine_collapse", count: 1 },
    { type: "mine_gas_lora", count: 1 },
    { type: "women_sos", count: 1 },
  ]
  const created = []
  for (const item of wave) {
    const tmpl = EVENT_TEMPLATES[item.type]
    for (let i = 0; i < item.count; i++) {
      const loc =
        item.type === "women_sos"
          ? getCrimeBasedSosLocation()
          : item.type === "mine_gas_lora" || item.type === "mine_collapse"
            ? { lat: 12.97 + Math.random() * 0.09, lng: 77.58 + Math.random() * 0.12 }
            : item.type === "chemical_leak"
              ? { lat: 12.96 + Math.random() * 0.05, lng: 77.62 + Math.random() * 0.11 }
              : { lat: randLat(), lng: randLng() }
      const severityBoost = item.type === "women_sos" ? 0 : 1
      const ev = createEvent({
        type: item.type,
        ...loc,
        severity: Math.min(10, (tmpl?.baseSeverity || 7) + severityBoost + Math.floor(Math.random() * 2)),
        source: "crisis_mode",
      })
      created.push(ev)
    }
  }
  return created
}

// ── Re-allocation: preempt a lower-priority agent for critical events ─────────
function checkReallocation(newEvent) {
  if (newEvent.severity < 9) return null
  for (const agent of agentEngine.getAgents()) {
    if (agent.status !== "assigned") continue
    const oldEvent = events.find(e => e.id === agent.current_task)
    if (!oldEvent) continue
    if (agentEngine.reassignIfNeeded(newEvent, oldEvent)) {
      console.log(`[DISASTER] Reallocation: ${agent.id} from ${oldEvent.id} → ${newEvent.id}`)
      oldEvent.assigned_agent = null
      oldEvent.status = "active"
      agentEngine.freeAgent(agent.id)
      return allocateToEvent(newEvent)
    }
  }
  return null
}

// ── Resolve ───────────────────────────────────────────────────────────────────
function resolveEvent(eventId) {
  const ev = events.find(e => e.id === eventId)
  if (ev) {
    ev.status = "resolved"
    ev.resolved_at = Date.now()
    if (ev.assigned_agent) agentEngine.freeAgent(ev.assigned_agent)
    if (Array.isArray(ev.secondary_assignments)) {
      for (const row of ev.secondary_assignments) agentEngine.freeAgent(row.agentId)
      ev.secondary_assignments = []
    }
  }
  return ev
}

// ── Agent Failure Simulation ──────────────────────────────────────────────────
function simulateAgentFailure(agentId) {
  const result = agentEngine.failAgent(agentId)
  if (result && result.failedTask) {
    const event = events.find(e => e.id === result.failedTask)
    if (event) {
      console.log(`[DISASTER] Agent ${agentId} failed! Re-allocating for event ${event.id}`)
      event.assigned_agent = null
      event.status = "active"
      if (Array.isArray(event.secondary_assignments)) {
        for (const row of event.secondary_assignments) agentEngine.freeAgent(row.agentId)
        event.secondary_assignments = []
      }
      const newAlloc = allocateToEvent(event)
      return { failedAgent: agentId, eventId: event.id, newAllocation: newAlloc }
    }
  }
  return null
}

/** Cascading interconnect + correlated incidents (secondary strike narrative for judges). */
function triggerCascadeStrike() {
  powerGridService.triggerCascadeShock()
  const hubLat = 12.9716 + (Math.random() - 0.5) * 0.024
  const hubLng = 77.5946 + (Math.random() - 0.5) * 0.03
  const ev1 = createEvent({
    type: "earthquake",
    lat: hubLat,
    lng: hubLng,
    severity: Math.min(10, 9 + Math.floor(Math.random() * 2)),
    source: "cascade_secondary",
  })
  const ev2 = createEvent({
    type: "industrial_hazard",
    lat: hubLat + (Math.random() > 0.5 ? 0.017 : -0.017),
    lng: hubLng + (Math.random() > 0.5 ? 0.015 : -0.015),
    severity: Math.min(10, 8 + Math.floor(Math.random() * 2)),
    source: "cascade_secondary",
  })
  const primary = allocateToEvent(ev1)
  let duo = allocateToEvent(ev2)
  if (!duo) duo = checkReallocation(ev2)
  return { events: [ev1, ev2], primary, secondaryCascade: duo }
}

// ── Startup: load synthetic events AND auto-allocate agents ──────────────────
function loadSyntheticEvents() {
  for (const e of SYNTHETIC_EVENTS) {
    const event = createEvent({ ...e, source: "synthetic" })
    allocateToEvent(event) // agents assigned from the start!
  }
  console.log(`[DISASTER] ${SYNTHETIC_EVENTS.length} events loaded & agents auto-allocated`)
}

function getEvents() { return events }
function getActiveEvents() { return events.filter(e => e.status !== "resolved") }
function getEventById(id) { return events.find(e => e.id === id) }
function getBlockedZones() { return blockedRoadZones }

function resetEvents() {
  events = []
  eventIdCounter = 1
  fairnessService.reset()
  agentEngine.resetAgents()
  loadSyntheticEvents()
}

loadRoadConstraints()
loadCrimeZones()

module.exports = {
  createEvent, triggerDisaster, allocateToEvent, resolveEvent, checkReallocation,
  triggerCrisisScenario,
  triggerCascadeStrike,
  simulateAgentFailure,
  getEvents, getActiveEvents, getEventById, resetEvents,
  loadSyntheticEvents, getCrimeBasedSosLocation, getEffectiveDistance, getBlockedZones,
}
