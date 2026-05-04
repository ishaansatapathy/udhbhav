/**
 * Sahayak – Unified Emergency + Police Station Server
 * Merges our RSA-signed EMERGENCY_EVENT / POLICE_ALERT system
 * with the teammate's station-awareness and cab-tracking features.
 * Port: 4000
 */

const path = require("path")
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") })

// ── Validate critical env vars at startup ─────────────────────────────────────
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("\n  ⚠️  EMAIL_USER / EMAIL_PASS missing in .env — email alerts will be DISABLED\n")
} else if (process.env.EMAIL_USER.includes("your_") || process.env.EMAIL_PASS.includes("your_")) {
  console.warn("\n  ⚠️  EMAIL_USER / EMAIL_PASS still has PLACEHOLDER values in .env")
  console.warn("  → Update .env with real Gmail address + 16-char App Password\n")
}

const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")
const geo = require("./geo")
const crypto = require("./crypto")
const intel = require("./intelligence")
const sosRoutes = require("./routes/sos")
const responderRoutes = require("./routes/responder")
const { registerSosSocketEvents } = require("./socket/sosSocketEvents")
const { registerCommunitySocketEvents, broadcastCommunityAlert } = require("./socket/communitySocketEvents")
const responderService = require("./services/responderService")
const contactsRoutes = require("./routes/contacts")
const reportRoutes = require("./routes/report")
const reportService = require("./services/reportService")
const vehicleReportRoutes = require("./routes/vehicleReport")
const vehicleService = require("./services/vehicleService")
const agentEngine = require("./services/agentEngine")
const disasterService = require("./services/disasterService")
const powerGridService = require("./services/powerGridService")
const negotiationService = require("./services/negotiationService")
const meshCommsService = require("./services/meshCommsService")
const crimeHotspotService = require("./services/crimeHotspotService")
const nlpService = require("./services/nlpService")
const fairnessService = require("./services/fairnessService")

/** Power ledger + negotiated MW settlement transcript (broadcast together). */
function emitInterconnect_bundle(targetIo) {
  const ev = disasterService.getEvents()
  const snap = powerGridService.buildSnapshot(ev)
  targetIo.emit("power:update", snap)
  const negotiationDelta = negotiationService.syncFromSnapshot(ev, snap)
  if (negotiationDelta) targetIo.emit("negotiation:update", negotiationDelta)
  const meshDelta = meshCommsService.syncFromSnapshot(snap)
  if (meshDelta) targetIo.emit("mesh:update", meshDelta)
}

/** Broadcast full mesh transcript (allocation/cascade/manual lines outside snapshot sync). */
function emitMeshState(targetIo) {
  targetIo.emit("mesh:update", meshCommsService.getState())
}

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } })

app.use(cors())
app.use(express.json())

// ── In-memory state ───────────────────────────────────────────────────────────

const alertLog = []
const cabState = new Map()
const movementHist = new Map()
const traceChain = new Map()
let lastAlertHash = "0"

// ── Load synthetic disaster events on startup ─────────────────────────────────
disasterService.loadSyntheticEvents()

// ── Disaster allocation helpers (ambulance + hospital paired dispatch) ────────
function pushAllocationBatch(allocations, event, result) {
  if (!result?.agent?.id) return
  meshCommsService.noteAllocation(event, result)
  allocations.push({ eventId: event.id, agentId: result.agent.id, score: result.score, candidates: result.candidates || [] })
  if (result.secondary?.id) {
    allocations.push({
      eventId: event.id,
      agentId: result.secondary.id,
      score: (result.score || 1) * 0.97,
      candidates: [],
    })
  }
}

function emitAllocationPair(targetIo, event, result) {
  if (!result?.agent?.id) return
  meshCommsService.noteAllocation(event, result)
  targetIo.emit("allocation:success", { eventId: event.id, agentId: result.agent.id, score: result.score, candidates: result.candidates || [] })
  if (result.secondary?.id) {
    targetIo.emit("allocation:success", {
      eventId: event.id,
      agentId: result.secondary.id,
      score: (result.score || 1) * 0.97,
      candidates: [],
    })
  }
  emitMeshState(targetIo)
}

// ── Agent tick: move vehicles every 2s and broadcast ─────────────────────────
// io is declared after this block, so we use a lazy ref
let _io = null
setInterval(() => {
  if (!_io) return
  const resolvedIds = new Set(disasterService.getEvents().filter(e => e.status === "resolved").map(e => e.id))
  agentEngine.tickAgents(resolvedIds)
  _io.emit("vehicles:update", agentEngine.getAgents())
  _io.emit("events:update", disasterService.getActiveEvents())
  emitInterconnect_bundle(_io)
}, 2000)

// ── REST API ──────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ status: "ok" }))

/** Police stations list */
app.get("/api/stations", (_req, res) => res.json(geo.getStations()))

// ── Disaster / Agent REST endpoints ──────────────────────────────────────────

/** GET all agents */
app.get("/api/agents", (_req, res) => res.json(agentEngine.getAgents()))

/** GET all events */
app.get("/api/events", (_req, res) => res.json(disasterService.getActiveEvents()))

/** GET blocked road zones */
app.get("/api/blocked-zones", (_req, res) => res.json(disasterService.getBlockedZones()))

/** GET crisis power interconnect snapshot (MW scarcity + utility loads) */
app.get("/api/power-grid", (_req, res) => {
  res.json(powerGridService.buildSnapshot(disasterService.getEvents()))
})

/** GET interconnect negotiation transcript (utility MW bids ↔ grid counter-offers ↔ finalize) */
app.get("/api/negotiation-log", (_req, res) => {
  res.json(negotiationService.getState())
})

/** GET mesh comms transcript (operator + utility chatter for demo visibility) */
app.get("/api/mesh-log", (_req, res) => {
  res.json(meshCommsService.getState())
})

/** GET city-level crime aggregates from bundled CSV (no per-record PII; not live feeds). */
app.get("/api/crime-hotspots", (req, res) => {
  const limit = Number(req.query?.limit)
  res.json(crimeHotspotService.getHotspots(Number.isFinite(limit) ? { limit } : {}))
})

/** GET/POST allocator fairness γ (duty spread vs greedy score; multi-incident relief for smaller loads) */
app.get("/api/fairness", (_req, res) => {
  res.json({ fairnessGamma: fairnessService.getFairnessGamma() })
})
app.post("/api/fairness", (req, res) => {
  const gamma = fairnessService.setFairnessGamma(req.body?.fairnessGamma ?? req.body?.gamma ?? 0.38)
  io.emit("fairness:update", { fairnessGamma: gamma })
  meshCommsService.noteFairnessGamma(gamma)
  emitMeshState(io)
  res.json({ fairnessGamma: gamma })
})

/** POST trigger a disaster scenario */
app.post("/api/disaster/trigger", (req, res) => {
  const { type } = req.body
  if (!type) return res.status(400).json({ error: "type required" })
  const newEvents = disasterService.triggerDisaster(type)
  const allocations = []
  for (const event of newEvents) {
    // Try normal allocation first, then re-allocation
    let result = disasterService.allocateToEvent(event)
    if (!result) result = disasterService.checkReallocation(event)
    pushAllocationBatch(allocations, event, result)
  }
  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  io.emit("allocation:batch", allocations)
  emitInterconnect_bundle(io)
  emitMeshState(io)
  res.json({ triggered: newEvents.length, allocations })
})

/** POST trigger full crisis wave */
app.post("/api/disaster/crisis", (_req, res) => {
  const newEvents = disasterService.triggerCrisisScenario()
  const allocations = []
  for (const event of newEvents) {
    let result = disasterService.allocateToEvent(event)
    if (!result) result = disasterService.checkReallocation(event)
    pushAllocationBatch(allocations, event, result)
  }
  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  io.emit("allocation:batch", allocations)
  emitInterconnect_bundle(io)
  emitMeshState(io)
  res.json({ triggered: newEvents.length, allocations, mode: "crisis" })
})

/** POST cascading interconnect strike — damage layer stacks + correlated incidents (renegotiates MW ledger) */
app.post("/api/disaster/cascade", (_req, res) => {
  const out = disasterService.triggerCascadeStrike()
  const allocations = []
  if (out.primary) pushAllocationBatch(allocations, out.events[0], out.primary)
  if (out.secondaryCascade) pushAllocationBatch(allocations, out.events[1], out.secondaryCascade)
  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  io.emit("allocation:batch", allocations)
  emitInterconnect_bundle(io)
  emitMeshState(io)
  res.json({
    ok: true,
    mode: "cascade",
    events: out.events.map(e => ({ id: e.id, type: e.type })),
    allocations,
  })
})

/** POST one-click PS demo — crisis wave then cascade strike (scarcity + renegotiation) */
app.post("/api/disaster/ps-demo", async (_req, res) => {
  const summary = {
    mode: "ps-demo",
    crisisTriggered: 0,
    cascadeTriggered: 0,
    allocations: 0,
    cascadeEvents: [],
  }

  const crisisEvents = disasterService.triggerCrisisScenario()
  summary.crisisTriggered = crisisEvents.length
  for (const ev of crisisEvents) {
    let result = disasterService.allocateToEvent(ev)
    if (!result) result = disasterService.checkReallocation(ev)
    if (result) {
      meshCommsService.noteAllocation(ev, result)
      summary.allocations++
    }
  }

  // Allow one heartbeat worth of allocations before secondary strike
  await new Promise(r => setTimeout(r, 650))

  const out = disasterService.triggerCascadeStrike()
  summary.cascadeTriggered = out.events.length
  summary.cascadeEvents = out.events.map(e => ({ id: e.id, type: e.type }))
  if (out.primary) {
    meshCommsService.noteAllocation(out.events[0], out.primary)
    summary.allocations++
  }
  if (out.secondaryCascade) {
    meshCommsService.noteAllocation(out.events[1], out.secondaryCascade)
    summary.allocations++
  }

  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  emitInterconnect_bundle(io)
  emitMeshState(io)
  res.json({ ok: true, summary })
})

/** POST one-click deterministic demo mission */
app.post("/api/disaster/demo-mission", (_req, res) => {
  const summary = { triggered: 0, allocations: 0, failedAgent: null, womenSosEvent: null }

  const crisisEvents = disasterService.triggerCrisisScenario()
  summary.triggered += crisisEvents.length
  for (const event of crisisEvents) {
    let result = disasterService.allocateToEvent(event)
    if (!result) result = disasterService.checkReallocation(event)
    if (result) {
      meshCommsService.noteAllocation(event, result)
      summary.allocations++
    }
  }

  const assigned = agentEngine.getAgents().find(a => a.status === "assigned")
  if (assigned) {
    const failResult = disasterService.simulateAgentFailure(assigned.id)
    if (failResult?.newAllocation && failResult.eventId) {
      const evFull = disasterService.getEventById(failResult.eventId)
      if (evFull) meshCommsService.noteAllocation(evFull, failResult.newAllocation)
    }
    if (failResult) summary.failedAgent = assigned.id
  }

  const womenSos = disasterService.triggerDisaster("women_sos")
  summary.triggered += womenSos.length
  for (const event of womenSos) {
    let result = disasterService.allocateToEvent(event)
    if (!result) result = disasterService.checkReallocation(event)
    if (result) {
      meshCommsService.noteAllocation(event, result)
      summary.allocations++
    }
    summary.womenSosEvent = event.id
  }

  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  emitInterconnect_bundle(io)
  emitMeshState(io)
  res.json({ ok: true, mode: "demo-mission", summary })
})

/** POST create a single custom event */
app.post("/api/disaster/event", (req, res) => {
  const { type, lat, lng, severity } = req.body
  if (!type) return res.status(400).json({ error: "type required" })
  const event = disasterService.createEvent({ type, lat, lng, severity, source: "manual" })
  const allocation = disasterService.allocateToEvent(event)
  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  emitAllocationPair(io, event, allocation)
  emitInterconnect_bundle(io)
  res.json({ event, allocation: allocation ? { agentId: allocation.agent.id } : null })
})

/** POST resolve an event */
app.post("/api/disaster/resolve", (req, res) => {
  const { eventId } = req.body
  const event = disasterService.resolveEvent(eventId)
  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  emitInterconnect_bundle(io)
  res.json({ resolved: !!event })
})

/** POST classify a tweet */
app.post("/api/nlp/classify", (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: "text required" })
  const result = nlpService.classifyText(text)
  // Auto-create event if disaster detected
  if (result.label === "disaster") {
    const eventType = nlpService.mapToEventType(result.disaster_type)
    const event = disasterService.createEvent({ type: eventType, severity: Math.floor(result.confidence * 10), source: "nlp_tweet" })
    const allocation = disasterService.allocateToEvent(event)
    io.emit("events:update", disasterService.getActiveEvents())
    io.emit("vehicles:update", agentEngine.getAgents())
    emitAllocationPair(io, event, allocation)
    emitInterconnect_bundle(io)
    result.event_created = event.id
  }
  res.json(result)
})

/** POST simulate an agent failure */
app.post("/api/disaster/simulate-failure", (req, res) => {
  const { agentId } = req.body
  if (!agentId) return res.status(400).json({ error: "agentId required" })
  const result = disasterService.simulateAgentFailure(agentId)
  
  if (result) {
    io.emit("events:update", disasterService.getActiveEvents())
    io.emit("vehicles:update", agentEngine.getAgents())
    if (result.newAllocation) {
      const evFull = disasterService.getEventById(result.eventId)
      if (evFull) emitAllocationPair(io, evFull, result.newAllocation)
    }
    emitInterconnect_bundle(io)
  }
  res.json({ success: !!result, result })
})

/** POST reset simulation */
app.post("/api/disaster/reset", (_req, res) => {
  disasterService.resetEvents() // resetEvents calls agentEngine.resetAgents() internally
  powerGridService.reset()
  negotiationService.reset()
  meshCommsService.reset()
  io.emit("events:update", disasterService.getActiveEvents())
  io.emit("vehicles:update", agentEngine.getAgents())
  io.emit("allocation:batch", [])
  emitMeshState(io)
  emitInterconnect_bundle(io)
  io.emit("fairness:update", { fairnessGamma: fairnessService.getFairnessGamma() })
  res.json({ ok: true, fairnessGamma: fairnessService.getFairnessGamma() })
})

/** Server RSA public key (PEM) */
app.get("/api/crypto/public-key", (_req, res) =>
  res.json({ publicKey: crypto.getPublicKeyPem() })
)

/**
 * POST /api/emergency
 * Accepts a signed emergency payload from external clients.
 * Verifies signature, chains SHA-256 hash, broadcasts to all.
 */
app.post("/api/emergency", (req, res) => {
  const { payload, signature } = req.body
  const sigToVerify = signature || crypto.signEmergencyPayload(payload)
  if (!crypto.verifySignature(payload, sigToVerify))
    return res.status(401).json({ error: "Invalid signature" })

  const alert = {
    id: `alert_${Date.now()}`,
    ...payload,
    prevHash: lastAlertHash,
    timestamp: Date.now(),
  }
  alert.hash = crypto.sha256(alert)
  lastAlertHash = alert.hash
  alertLog.push(alert)

  io.emit("POLICE_ALERT", {
    payload: alert,
    signature: sigToVerify,
    publicKey: crypto.getPublicKeyPem(),
    receivedAt: Date.now(),
    socketId: "api",
  })
  res.json({ ok: true, alertId: alert.id })
})

// ── SOS Routes ────────────────────────────────────────────────────────────────
app.use("/api/sos", sosRoutes.router)
sosRoutes.setIo(io)

// ── Community Response Routes ─────────────────────────────────────────────────
app.use("/api/respond", responderRoutes.router)
responderRoutes.setIo(io)

// ── Trusted Contacts Routes ───────────────────────────────────────────────────
app.use("/api/contacts", contactsRoutes)

// ── Unified Report Routes ─────────────────────────────────────────────────────
app.use("/api/report", reportRoutes.router)
reportRoutes.setIo(io)

// ── Vehicle Report Routes ─────────────────────────────────────────────────────
app.use("/api/vehicle-report", vehicleReportRoutes.router)
vehicleReportRoutes.setIo(io)

// Wire auto-escalation → Socket.io broadcast
const emergencyService = require("./services/emergencyService")
const { broadcastUpdateEmergency } = require("./socket/sosSocketEvents")
emergencyService.setEscalationBroadcast((emergency) => {
  broadcastUpdateEmergency(io, emergency)
})

// Wire community alert on every new emergency
emergencyService.setOnCreateCallback((emergency) => {
  const nearby = responderService.findNearbyResponders(emergency.lat, emergency.lng)
  if (nearby.length > 0) {
    broadcastCommunityAlert(io, emergency, nearby)
  }
})

// ── Socket.io ─────────────────────────────────────────────────────────────────

io.on("connection", (socket) => {
  _io = io // set lazy reference for the tick interval
  console.log(`[+] Client connected   id=${socket.id}`)

  // Send initial disaster state to newly connected client
  socket.emit("vehicles:update", agentEngine.getAgents())
  socket.emit("events:update", disasterService.getActiveEvents())
  const bootEv = disasterService.getEvents()
  const bootSnap = powerGridService.buildSnapshot(bootEv)
  negotiationService.syncFromSnapshot(bootEv, bootSnap)
  socket.emit("power:update", bootSnap)
  socket.emit("negotiation:update", negotiationService.getState())
  socket.emit("mesh:update", meshCommsService.getState())
  socket.emit("fairness:update", { fairnessGamma: fairnessService.getFairnessGamma() })


  // Send existing incident reports to newly connected client (Police Dashboard)
  const existingReports = reportService.getReports()
  if (existingReports.length > 0) {
    socket.emit("initial_reports", existingReports)
  }

  // Send existing vehicle reports to newly connected client
  const existingVehicleReports = vehicleService.getReports()
  if (existingVehicleReports.length > 0) {
    socket.emit("initial_vehicle_reports", existingVehicleReports)
  }

  // Send alert history to newly connected clients (police dashboard)
  if (alertLog.length > 0) {
    const history = alertLog.map(a => ({
      payload: a, signature: "", publicKey: "",
      receivedAt: a.timestamp, socketId: "history",
    }))
    socket.emit("ALERT_HISTORY", history)
  }

  // ── Our emergency channel ─────────────────────────────────────────────────
  socket.on("EMERGENCY_EVENT", (data) => {
    const enriched = { ...data, receivedAt: Date.now(), socketId: socket.id }
    console.log(`[!] EMERGENCY_EVENT  trip=${data?.payload?.tripId}  from=${socket.id}`)
    alertLog.push({ ...data.payload, receivedAt: enriched.receivedAt })
    io.emit("POLICE_ALERT", enriched)

    // Also send email alerts to trusted contacts for cab emergencies
    const { sendEmailToContacts } = require("./services/emailService")
    const payload = data?.payload || {}
    sendEmailToContacts({
      event_id: payload.tripId || `CAB_${Date.now()}`,
      lat: payload.location?.lat ?? payload.lat ?? 0,
      lng: payload.location?.lng ?? payload.lng ?? 0,
      level: payload.severity || "HIGH",
      user_id: payload.cabId || "cab-user",
      timestamp: Date.now(),
    })
      .then(r => console.log(`[CAB] Email alerts: ${r.sent} sent, ${r.failed} failed`))
      .catch(err => console.error("[CAB] Email alert error:", err.message))
  })

  // ── Teammate's station channel ────────────────────────────────────────────
  socket.on("join_station", (stationId) => {
    socket.join(`station:${stationId}`)
    const cabs = [...cabState.entries()]
      .filter(([, s]) => s.stationId === stationId)
      .map(([id, s]) => ({ id, ...s }))
    socket.emit("station_cabs", cabs)
    for (const [cabId, chain] of traceChain.entries()) {
      const cab = cabState.get(cabId)
      if (cab && cab.stationId === stationId) socket.emit("trace_chain_update", { cabId, chain })
    }
  })

  socket.on("cab_position", (data) => {
    const { cabId, lat, lon } = data
    const now = Date.now()

    let hist = movementHist.get(cabId) || []
    hist.push({ lat, lon, ts: now })
    if (hist.length > 20) hist = hist.slice(-20)
    movementHist.set(cabId, hist)

    const station = geo.getOwningStation(lat, lon)
    const prevState = cabState.get(cabId)
    const prevStationId = prevState?.stationId

    const tripToken = prevState?.tripToken || crypto.generateTripToken({ cabId, lat, lon })
    const riskScore = intel.computeRiskScore(cabId, movementHist, traceChain)
    const predictedNext = intel.predictNextStation(cabId, movementHist, geo.getStations())

    const newState = {
      lat, lon,
      stationId: station.id,
      stationName: station.name,
      tripToken,
      insideRadius: station.insideRadius,
      lastUpdate: now,
      riskScore,
      predictedNextStationId: predictedNext ? predictedNext.id : null,
      predictedNextStationName: predictedNext ? predictedNext.name : null,
      isAlert: false,
    }

    if (prevStationId && prevStationId !== station.id) {
      const entry = intel.buildTraceEntry(station.id, station.name)
      const chain = intel.chainTrace(traceChain, cabId, entry)
      io.to(`station:${prevStationId}`).emit("cab_left", cabId)
      io.emit("trace_chain_update", { cabId, chain })
      io.to(`station:${station.id}`).emit("predicted_incoming", { cabId, ...newState, type: "ACTUAL" })
    } else if (!prevStationId && station.insideRadius) {
      const entry = intel.buildTraceEntry(station.id, station.name)
      const chain = intel.chainTrace(traceChain, cabId, entry)
      io.emit("trace_chain_update", { cabId, chain })
    }
    if (predictedNext && predictedNext.id !== station.id) {
      io.to(`station:${predictedNext.id}`).emit("predicted_incoming", {
        cabId, ...newState, type: "PREDICTED", etaSeconds: 90,
      })
    }

    const distressTriggers = intel.checkSilentDistress(cabId, movementHist, traceChain, riskScore)
    if (distressTriggers.length > 0) {
      newState.isAlert = true
      newState.distressTriggers = distressTriggers
      const alertPayload = {
        cabId, lat, lon, stationId: station.id, riskScore,
        traceChain: traceChain.get(cabId) || [],
        triggers: distressTriggers, type: "SILENT_DISTRESS",
        severity: riskScore >= 75 ? "CRITICAL" : riskScore >= 50 ? "HIGH" : "MEDIUM",
      }
      const alert = { id: `alert_${Date.now()}`, ...alertPayload, prevHash: lastAlertHash, timestamp: Date.now() }
      alert.hash = crypto.sha256(alert)
      lastAlertHash = alert.hash
      alertLog.push(alert)
      io.emit("silent_alert", alert)
      const eventType = distressTriggers.includes("RISK_CRITICAL") ? "women_sos" : "fire"
      const derivedSeverity = Math.max(7, Math.min(10, Math.round(riskScore / 10)))
      const anomalyEvent = disasterService.createEvent({
        type: eventType,
        lat,
        lng: lon,
        severity: derivedSeverity,
        source: "anomaly_detection",
      })
      let anomalyAllocation = disasterService.allocateToEvent(anomalyEvent)
      if (!anomalyAllocation) anomalyAllocation = disasterService.checkReallocation(anomalyEvent)
      if (anomalyAllocation) emitAllocationPair(io, anomalyEvent, anomalyAllocation)
      io.emit("events:update", disasterService.getActiveEvents())
      io.emit("vehicles:update", agentEngine.getAgents())
      emitInterconnect_bundle(io)
    }

    cabState.set(cabId, newState)
    io.to(`station:${station.id}`).emit("cab_update", { cabId, ...newState })
  })

  socket.on("disconnect", (reason) => {
    console.log(`[-] Client disconnected id=${socket.id}  reason=${reason}`)
  })
})

// ── Register SOS socket events ────────────────────────────────────────────────
registerSosSocketEvents(io)
registerCommunitySocketEvents(io)

// ── Start ─────────────────────────────────────────────────────────────────────

const DEFAULT_PORT = Number(process.env.PORT) || 4000

function startServer(port) {
  server
    .listen(port, () => {
      console.log(`\n  Sahayak Unified Server`)
      console.log(`  Emergency + Police Station + SOS API`)
      console.log(`  http://localhost:${port}`)
      console.log(`  Press Ctrl+C to stop\n`)
    })
    .once("error", (err) => {
      if (err && err.code === "EADDRINUSE") {
        const nextPort = port + 1
        console.warn(`\n  Port ${port} is busy. Retrying on ${nextPort}...\n`)
        startServer(nextPort)
        return
      }
      console.error("\n  Failed to start server:", err)
      process.exit(1)
    })
}

startServer(DEFAULT_PORT)
