/**
 * agentEngine.js
 * Multi-Agent Resource Allocation Engine
 * Manages 30 vehicles (ambulances, police, cabs) as autonomous agents
 */

// ── Priority weights per agent type ───────────────────────────────────────────
const PRIORITY_WEIGHTS = {
  ambulance: 1.52,
  hospital: 1.68, // MCI field hospital / casualty clearing — pairs with miners & gas anomalies
  police: 1.2,
  cab: 1.0,
}

const HOSPITAL_SPAWN_POINTS = [
  { lat: 12.9175, lng: 77.5928 },
  { lat: 13.0312, lng: 77.5954 },
  { lat: 12.9683, lng: 77.5812 },
  { lat: 12.9388, lng: 77.5981 },
]

// ── Bangalore-centric coordinates for initial spawn ───────────────────────────
const SPAWN_ZONES = [
  { lat: 12.9716, lng: 77.5946 }, // Bangalore City Center
  { lat: 12.9352, lng: 77.6245 }, // Koramangala
  { lat: 13.0358, lng: 77.5970 }, // Hebbal
  { lat: 12.9010, lng: 77.6069 }, // Jayanagar
  { lat: 12.9698, lng: 77.7500 }, // Whitefield
  { lat: 13.0120, lng: 77.5520 }, // Rajajinagar
  { lat: 12.8500, lng: 77.6500 }, // Electronic City
  { lat: 12.9855, lng: 77.7480 }, // Marathahalli
  { lat: 13.0550, lng: 77.6500 }, // Yelahanka
  { lat: 12.9300, lng: 77.5500 }, // Banashankari
]

function randomNear(center, radiusDeg = 0.04) {
  return {
    lat: center.lat + (Math.random() - 0.5) * radiusDeg * 2,
    lng: center.lng + (Math.random() - 0.5) * radiusDeg * 2,
  }
}

// ── OSRM route fetching for road-accurate agent movement ──────────────────────

/** Per-agent route waypoints: agentId → { waypoints: [[lat,lng],...], waypointIdx: number } */
const agentRoutes = new Map()

const OSRM_URLS = [
  "https://router.project-osrm.org/route/v1/driving",
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
]

/**
 * Fetch OSRM driving route and return [[lat,lng],...] waypoints.
 * Falls back to straight line on failure.
 */
async function fetchRouteWaypoints(fromLat, fromLng, toLat, toLng) {
  const coordStr = `${fromLng},${fromLat};${toLng},${toLat}`
  for (const base of OSRM_URLS) {
    try {
      const url = `${base}/${coordStr}?overview=full&geometries=geojson`
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) continue
      const data = await res.json()
      if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) continue
      const coords = data.routes[0].geometry.coordinates
      // OSRM returns [lng, lat], convert to [lat, lng]
      const waypoints = coords.map(([lng, lat]) => [lat, lng])
      if (waypoints.length >= 2) return waypoints
    } catch {
      // try next URL
    }
  }
  // Fallback: straight line
  return [[fromLat, fromLng], [toLat, toLng]]
}

/**
 * Kick off route fetch for an assigned agent. Non-blocking — agent starts
 * moving straight and switches to road waypoints once the fetch completes.
 */
function fetchRouteForAgent(agent) {
  if (!agent.targetLat || !agent.targetLng) return
  const agentId = agent.id
  // Start with straight-line fallback immediately
  agentRoutes.set(agentId, {
    waypoints: [[agent.lat, agent.lng], [agent.targetLat, agent.targetLng]],
    waypointIdx: 0,
  })
  // Fire async route fetch
  fetchRouteWaypoints(agent.lat, agent.lng, agent.targetLat, agent.targetLng)
    .then(wp => {
      // Only update if agent is still assigned to the same target
      const current = agentRoutes.get(agentId)
      if (!current) return
      if (agent.status !== "assigned") return
      // Merge: keep current position as first waypoint, splice in road geometry
      agentRoutes.set(agentId, { waypoints: wp, waypointIdx: 0 })
      console.log(`[ROUTE] ${agentId} got ${wp.length} road waypoints from OSRM`)
    })
    .catch(() => {
      // keep straight-line fallback
    })
}

// ── Generate 30 agents ────────────────────────────────────────────────────────
function generateAgents() {
  const agents = []
  let idCounter = 1

  // 10 ambulances
  for (let i = 0; i < 10; i++) {
    const zone = SPAWN_ZONES[i % SPAWN_ZONES.length]
    const pos = randomNear(zone)
    agents.push({
      id: `agent_${idCounter++}`,
      type: "ambulance",
      status: "idle",
      fuel_level: 70 + Math.floor(Math.random() * 30),
      lat: pos.lat,
      lng: pos.lng,
      current_task: null,
      priority_weight: PRIORITY_WEIGHTS.ambulance,
      targetLat: null,
      targetLng: null,
      stepProgress: 0,
      assignment_load: 0,
    })
  }

  // 10 police vehicles
  for (let i = 0; i < 10; i++) {
    const zone = SPAWN_ZONES[i % SPAWN_ZONES.length]
    const pos = randomNear(zone)
    agents.push({
      id: `agent_${idCounter++}`,
      type: "police",
      status: "idle",
      fuel_level: 60 + Math.floor(Math.random() * 40),
      lat: pos.lat,
      lng: pos.lng,
      current_task: null,
      priority_weight: PRIORITY_WEIGHTS.police,
      targetLat: null,
      targetLng: null,
      stepProgress: 0,
      assignment_load: 0,
    })
  }

  // 6 cabs
  for (let i = 0; i < 6; i++) {
    const zone = SPAWN_ZONES[i % SPAWN_ZONES.length]
    const pos = randomNear(zone)
    agents.push({
      id: `agent_${idCounter++}`,
      type: "cab",
      status: "idle",
      fuel_level: 50 + Math.floor(Math.random() * 50),
      lat: pos.lat,
      lng: pos.lng,
      current_task: null,
      priority_weight: PRIORITY_WEIGHTS.cab,
      targetLat: null,
      targetLng: null,
      stepProgress: 0,
      assignment_load: 0,
    })
  }

  // 4 hospital / MCI liaison units (trauma readiness, casualty surge)
  for (let i = 0; i < 4; i++) {
    const base = HOSPITAL_SPAWN_POINTS[i % HOSPITAL_SPAWN_POINTS.length]
    const pos = randomNear(base, 0.012)
    agents.push({
      id: `agent_${idCounter++}`,
      type: "hospital",
      status: "idle",
      fuel_level: 72 + Math.floor(Math.random() * 25),
      lat: pos.lat,
      lng: pos.lng,
      current_task: null,
      priority_weight: PRIORITY_WEIGHTS.hospital,
      targetLat: null,
      targetLng: null,
      stepProgress: 0,
      assignment_load: 0,
    })
  }

  return agents
}

// ── Global agent pool ─────────────────────────────────────────────────────────
let agents = generateAgents()

// ── Haversine distance in km ──────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Core scoring function ─────────────────────────────────────────────────────
// score = (event.severity * agent.priority_weight) / distance
function computeScore(agent, event) {
  const dist = haversine(agent.lat, agent.lng, event.lat, event.lng)
  const effectiveDist = Math.max(dist, 0.1) // avoid division by zero
  return (event.severity * agent.priority_weight) / effectiveDist
}

// ── Check if agent can accept a task ─────────────────────────────────────────
function canAccept(agent, event, filter = null) {
  if (agent.status !== "idle") return { ok: false, reason: "already_busy" }
  if (agent.fuel_level < 15) return { ok: false, reason: "fuel_low" }
  if (filter?.allowedTypes?.length && !filter.allowedTypes.includes(agent.type)) {
    return { ok: false, reason: "type_filtered" }
  }
  if (filter?.excludedIds?.has(agent.id)) return { ok: false, reason: "excluded" }
  // Underground mine / toxic plume corridors — taxis not routed into sterile evacuation ring (demo rule)
  if (
    (event.type === "mine_gas_lora" || event.type === "mine_collapse" || event.type === "chemical_leak") &&
    agent.type === "cab"
  ) {
    return { ok: false, reason: "type_mismatch" }
  }
  // Women SOS events → only ambulance or police
  if (event.type === "women_sos" && (agent.type === "cab" || agent.type === "hospital")) {
    return { ok: false, reason: "type_mismatch" }
  }
  return { ok: true }
}

// ── Main allocation: find best agent for an event ─────────────────────────────
function allocateAgent(event, distanceFn, filter, fairnessCtx) {
  const gamma =
    fairnessCtx && typeof fairnessCtx.fairnessGamma === "number" ? fairnessCtx.fairnessGamma : 0
  const activeEvents = fairnessCtx && Array.isArray(fairnessCtx.activeEvents) ? fairnessCtx.activeEvents : []

  const raw = []

  for (const agent of agents) {
    const check = canAccept(agent, event, filter)
    if (!check.ok) continue

    let dist, roadPenalty
    if (distanceFn) {
      const result = distanceFn(agent.lat, agent.lng, event.lat, event.lng)
      dist = result.distance
      roadPenalty = result.penalty
    } else {
      dist = haversine(agent.lat, agent.lng, event.lat, event.lng)
      roadPenalty = 1.0
    }

    const effectiveDist = Math.max(dist, 0.1)
    const baseScore = (event.severity * agent.priority_weight) / effectiveDist
    const directDist = haversine(agent.lat, agent.lng, event.lat, event.lng)
    raw.push({
      agent,
      baseScore,
      dist: directDist,
      effectiveDist,
      roadPenalty,
      priorityWeight: agent.priority_weight,
      severity: event.severity,
    })
  }

  if (raw.length === 0) return null

  const unresolved = activeEvents.filter(e => e.status !== "resolved")
  const unresolvedN = unresolved.length
  const maxSevPeer =
    unresolvedN > 0 ? Math.max(...unresolved.map(e => e.severity), event.severity) : event.severity

  const meanLoad = raw.reduce((s, c) => s + (c.agent.assignment_load || 0), 0) / raw.length

  for (const c of raw) {
    const load = c.agent.assignment_load || 0
    const diff = load - meanLoad
    const fairnessMult = gamma > 0 ? Math.exp(-gamma * 0.45 * diff) : 1
    const sevGap = maxSevPeer - event.severity
    const manyOpen = unresolvedN >= 4
    const underservedEvent = gamma > 0 && manyOpen && sevGap >= 2 && event.severity < maxSevPeer
    const impactMult = underservedEvent
      ? 1 + gamma * 0.12 * Math.min(1.15, (unresolvedN - 3) / 7)
      : 1
    c.fairnessMult = fairnessMult
    c.impactMult = impactMult
    c.score = c.baseScore * fairnessMult * impactMult
  }

  raw.sort((a, b) => b.score - a.score)
  const win = raw[0]
  const winner = win.agent

  winner.status = "assigned"
  winner.current_task = event.id
  winner.targetLat = event.lat
  winner.targetLng = event.lng
  winner.stepProgress = 0
  winner.fuel_level = Math.max(0, winner.fuel_level - Math.floor(win.dist))
  winner.assignment_load = (winner.assignment_load || 0) + event.severity / 6.5 + 0.28

  // Fetch OSRM road route for realistic movement
  fetchRouteForAgent(winner)

  console.log(
    `[AGENT] ${winner.id} (${winner.type}) → event ${event.id} | final=${win.score.toFixed(2)} base=${win.baseScore.toFixed(2)} ` +
      `fair×${win.fairnessMult.toFixed(2)} impact×${win.impactMult.toFixed(2)} dist=${win.dist.toFixed(2)}km γ=${gamma.toFixed(2)}`
  )

  return {
    agent: winner,
    score: win.score,
    distance: win.dist,
    effective_distance: win.effectiveDist,
    road_penalty: win.roadPenalty,
    rejected: raw.slice(1).map(c => c.agent.id),
    candidates: raw.slice(0, 3).map((c, rank) => {
      const load = c.agent.assignment_load || 0
      const diff = load - meanLoad
      let rationale = `Sev ${c.severity}×Wt ${c.priorityWeight} / eff D ${c.effectiveDist.toFixed(2)}`
      if (gamma > 0.02) {
        rationale += ` · fairness ${diff >= 0 ? "penalizes" : "boosts"} duty skew ${Math.abs(diff).toFixed(2)} → ×${c.fairnessMult.toFixed(2)}`
        if (c.impactMult > 1.01) rationale += ` · multi-incident ×${c.impactMult.toFixed(2)}`
      }
      return {
        rank: rank + 1,
        agentId: c.agent.id,
        type: c.agent.type,
        score: c.score,
        base_score: Number(c.baseScore.toFixed(4)),
        fairness_multiplier: Number(c.fairnessMult.toFixed(4)),
        impact_multiplier: Number(c.impactMult.toFixed(4)),
        assignment_load: Number((c.agent.assignment_load || 0).toFixed(3)),
        distance_km: c.dist,
        effective_distance_km: c.effectiveDist,
        road_penalty: c.roadPenalty,
        priority_weight: c.priorityWeight,
        severity: c.severity,
        score_rationale: rationale,
      }
    }),
  }
}


// ── Move agents one step toward their target (called on tick) ────────────────
// Follows OSRM waypoints if available, otherwise straight-line fallback.
function tickAgents(resolvedEventIds = new Set()) {
  for (const agent of agents) {
    const al = agent.assignment_load ?? 0
    if (al > 0.015) agent.assignment_load = Number((al * 0.964).toFixed(4))
  }
  for (const agent of agents) {
    if (agent.status === "assigned" && agent.targetLat !== null) {
      const STEP = 0.004 // ~400m per tick
      const route = agentRoutes.get(agent.id)

      if (route && route.waypoints.length >= 2) {
        // ── Follow road waypoints ──
        let budget = STEP
        while (budget > 0.0001 && route.waypointIdx < route.waypoints.length - 1) {
          const nextWp = route.waypoints[route.waypointIdx + 1]
          const dLat = nextWp[0] - agent.lat
          const dLng = nextWp[1] - agent.lng
          const segDist = Math.sqrt(dLat * dLat + dLng * dLng)

          if (segDist <= budget) {
            // Reached this waypoint, advance to next
            agent.lat = nextWp[0]
            agent.lng = nextWp[1]
            budget -= segDist
            route.waypointIdx++
          } else {
            // Partial move along this segment
            const ratio = budget / segDist
            agent.lat += dLat * ratio
            agent.lng += dLng * ratio
            budget = 0
          }
        }

        // Calculate overall progress
        const totalWp = route.waypoints.length - 1
        const progress = totalWp > 0 ? Math.round((route.waypointIdx / totalWp) * 100) : 0
        agent.stepProgress = Math.min(99, progress)

        // Check if arrived at final destination
        const toTarget = Math.sqrt(
          (agent.targetLat - agent.lat) ** 2 + (agent.targetLng - agent.lng) ** 2
        )
        if (toTarget < STEP || route.waypointIdx >= route.waypoints.length - 1) {
          agent.lat = agent.targetLat
          agent.lng = agent.targetLng
          agent.status = "busy"
          agent.stepProgress = 100
          agentRoutes.delete(agent.id)
        }
      } else {
        // ── Straight-line fallback (no route yet) ──
        const dLat = agent.targetLat - agent.lat
        const dLng = agent.targetLng - agent.lng
        const dist = Math.sqrt(dLat * dLat + dLng * dLng)

        if (dist < STEP) {
          agent.lat = agent.targetLat
          agent.lng = agent.targetLng
          agent.status = "busy"
          agent.stepProgress = 100
          agentRoutes.delete(agent.id)
        } else {
          const ratio = STEP / dist
          agent.lat += dLat * ratio
          agent.lng += dLng * ratio
          agent.stepProgress = Math.min(99, agent.stepProgress + 5)
        }
      }
    }

    // Free busy agent if its task is resolved
    if (agent.status === "busy" && resolvedEventIds.has(agent.current_task)) {
      freeAgent(agent.id)
    }
  }
}

// ── Free agent after task completion ─────────────────────────────────────────
function freeAgent(agentId) {
  const agent = agents.find((a) => a.id === agentId)
  if (agent) {
    agent.status = "idle"
    agent.current_task = null
    agent.targetLat = null
    agent.targetLng = null
    agent.stepProgress = 0
    agent.fuel_level = Math.min(100, agent.fuel_level + 20) // refuel on return
    agentRoutes.delete(agentId)
    console.log(`[AGENT] ${agentId} is now idle (task resolved)`)
  }
}

// ── Reassign if higher priority event arrives ─────────────────────────────────
function reassignIfNeeded(newEvent, existingEvent) {
  if (!existingEvent) return false
  // Only reassign if new event is 3+ severity higher
  return newEvent.severity >= existingEvent.severity + 3
}

// ── Simulate Agent Failure ────────────────────────────────────────────────────
function failAgent(agentId) {
  const agent = agents.find((a) => a.id === agentId)
  if (agent && agent.status === "assigned") {
    agent.status = "failed"
    agent.fuel_level = 0
    const failedTask = agent.current_task
    agent.current_task = null
    agent.targetLat = null
    agent.targetLng = null
    agent.stepProgress = 0
    agentRoutes.delete(agentId)
    console.log(`[AGENT] ⚠️ ${agentId} FAILED (Breakdown simulated)`)
    return { agent, failedTask }
  }
  return null
}

// ── Getters ───────────────────────────────────────────────────────────────────
function getAgents() {
  return agents
}

function getAgentById(id) {
  return agents.find((a) => a.id === id)
}

function resetAgents() {
  agents = generateAgents()
  agentRoutes.clear()
}

module.exports = {
  getAgents,
  getAgentById,
  allocateAgent,
  tickAgents,
  freeAgent,
  reassignIfNeeded,
  failAgent,
  resetAgents,
  haversine,
}
