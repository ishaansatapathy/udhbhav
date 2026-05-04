import { useEffect, useRef, useState, useCallback } from "react"
import { io, Socket } from "socket.io-client"

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"

export interface UtilityPowerRow {
  id: string
  label: string
  /** Short ticker for mesh / UI (falls back to id on server when missing). */
  shortCode?: string
  requestedMW: number
  minMW: number
  criticality: number
  allocatedMW: number
  shortfallMW: number
}

export interface PowerLedgerSnapshot {
  nominalMW: number
  availableMW: number
  stressIndex: number
  baseStressIndex?: number
  cascadeStrikeCount?: number
  cascadeResidualStress?: number
  cascadeActive?: boolean
  derateFactor: number
  updatedAt: number
  utilities: UtilityPowerRow[]
  stakeholderAgents?: UtilityStakeholderAgent[]
  sumRequested: number
  sumMin: number
  servedMW: number
  unservedMW: number
  blackoutRiskPct: number
  loadPctOfCapacity: number
}

export interface UtilityStakeholderAgent {
  id: string
  utilityId: string
  label: string
  shortCode: string
  lat: number
  lng: number
  mandate: string
  fleetBridge: string
  requestedMW: number
  minMW: number
  criticality: number
  allocatedMW: number
  shortfallMW: number
  status: "nominal" | "stressed" | "load_shedding" | "mandate_breach"
  objective: string
}

export interface NegotiationLine {
  id: string
  ts: number
  sessionId: string
  round: number
  phase: string
  speaker: string
  body: string
}

export interface NegotiationLogPayload {
  lines: NegotiationLine[]
  updatedAt: number
}

export interface MeshMessage {
  id: string
  ts: number
  speaker: string
  role: string
  channel: string
  body: string
}

export interface MeshLogPayload {
  messages: MeshMessage[]
  updatedAt: number
}

/** City centroid aggregate — no street-level coords (privacy-safe narration layer). */
export interface CrimeCityHotspot {
  city: string
  lat: number
  lng: number
  count: number
  topDomain: string | null
}

export interface CrimeDomainRollup {
  domain: string
  count: number
}

export interface CrimeHotspotsPayload {
  points: CrimeCityHotspot[]
  disclaimer: string
  source: string
  schemaVersion?: number
  rowCount: number
  cityCount: number
  sampledCitiesReturned: number
  /** Taxonomy-only national counts (no geo). */
  topDomainsNational?: CrimeDomainRollup[]
  missingFile: boolean
  updatedAt: number
}

export interface Agent {
  id: string
  type: "ambulance" | "police" | "cab" | "hospital"
  status: "idle" | "assigned" | "busy"
  fuel_level: number
  lat: number
  lng: number
  current_task: string | null
  priority_weight: number
  assignment_load?: number
  targetLat: number | null
  targetLng: number | null
  stepProgress: number
}

export interface DisasterEvent {
  id: string
  type: string
  severity: number
  casualties_est: number
  lat: number
  lng: number
  description: string
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  status: "active" | "responding" | "resolved"
  source: string
  timestamp: number
  assigned_agent: string | null
  /** Ambulance + hospital paired response (chemical toxic gas / hazmat, miners / STM32-LoRa gas anomaly, mine collapse) */
  secondary_assignments?: Array<{
    agentId: string
    type: string
    role: string
    score?: number
  }>
  sensor_meta?: {
    hardware?: string
    tunnel_node?: string
    readings?: string[]
    gateway_ack?: string
  }
  allocation_explain?: Array<{
    rank: number
    agentId: string
    type: string
    score: number
    base_score?: number
    fairness_multiplier?: number
    impact_multiplier?: number
    assignment_load?: number
    score_rationale?: string
    distance_km: number
    effective_distance_km: number
    road_penalty: number
    priority_weight: number
    severity: number
  }>
}

export interface Allocation {
  eventId: string
  agentId: string
  score: number
  receivedAt?: number
  candidates?: Array<{
    rank: number
    agentId: string
    type: string
    score: number
    base_score?: number
    fairness_multiplier?: number
    impact_multiplier?: number
    assignment_load?: number
    score_rationale?: string
    distance_km: number
    effective_distance_km: number
    road_penalty: number
    priority_weight: number
    severity: number
  }>
}

export function useMultiAgent() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [events, setEvents] = useState<DisasterEvent[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [powerLedger, setPowerLedger] = useState<PowerLedgerSnapshot | null>(null)
  const [negotiationLog, setNegotiationLog] = useState<NegotiationLogPayload | null>(null)
  const [meshLog, setMeshLog] = useState<MeshLogPayload | null>(null)
  const [crimeHotspots, setCrimeHotspots] = useState<CrimeHotspotsPayload | null>(null)
  const [fairnessGamma, setFairnessGammaState] = useState(0.38)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const [blockedZones, setBlockedZones] = useState<any[]>([])

  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ["websocket", "polling"] })
    socketRef.current = socket

    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    socket.on("vehicles:update", (data: Agent[]) => setAgents(data))
    socket.on("events:update", (data: DisasterEvent[]) => setEvents(data))
    socket.on("allocation:success", (a: Allocation) =>
      setAllocations(prev => [{ ...a, receivedAt: Date.now() }, ...prev].slice(0, 20))
    )
    socket.on("allocation:batch", (batch: Allocation[]) =>
      setAllocations(prev => [...batch.map(item => ({ ...item, receivedAt: Date.now() })), ...prev].slice(0, 20))
    )
    socket.on("power:update", (snap: PowerLedgerSnapshot) => setPowerLedger(snap))
    socket.on("negotiation:update", (payload: NegotiationLogPayload) => setNegotiationLog(payload))
    socket.on("mesh:update", (payload: MeshLogPayload) => {
      if (payload?.messages) setMeshLog(payload)
    })
    socket.on("fairness:update", (payload: { fairnessGamma: number }) => {
      if (typeof payload?.fairnessGamma === "number") setFairnessGammaState(payload.fairnessGamma)
    })

    // Fetch initial state
    fetch(`${SERVER_URL}/api/blocked-zones`)
      .then(res => res.json())
      .then(data => setBlockedZones(data))
      .catch(err => console.error(err))

    fetch(`${SERVER_URL}/api/power-grid`)
      .then(res => res.json())
      .then((data: PowerLedgerSnapshot) => setPowerLedger(data))
      .catch(err => console.error(err))

    fetch(`${SERVER_URL}/api/negotiation-log`)
      .then(res => res.json())
      .then((data: NegotiationLogPayload) => setNegotiationLog(data))
      .catch(err => console.error(err))

    fetch(`${SERVER_URL}/api/mesh-log`)
      .then(res => res.json())
      .then((data: MeshLogPayload) => {
        if (data?.messages) setMeshLog(data)
      })
      .catch(err => console.error(err))

    fetch(`${SERVER_URL}/api/crime-hotspots?limit=25`)
      .then(res => res.json())
      .then((data: CrimeHotspotsPayload) => {
        if (data?.points) setCrimeHotspots(data)
      })
      .catch(err => console.error(err))

    fetch(`${SERVER_URL}/api/fairness`)
      .then(res => res.json())
      .then((data: { fairnessGamma?: number }) => {
        if (typeof data?.fairnessGamma === "number") setFairnessGammaState(data.fairnessGamma)
      })
      .catch(err => console.error(err))

    return () => { socket.disconnect() }
  }, [])

  const triggerDisaster = useCallback(async (type: string) => {
    await fetch(`${SERVER_URL}/api/disaster/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    })
  }, [])

  const triggerCrisis = useCallback(async () => {
    await fetch(`${SERVER_URL}/api/disaster/crisis`, { method: "POST" })
  }, [])

  const triggerCascade = useCallback(async () => {
    await fetch(`${SERVER_URL}/api/disaster/cascade`, { method: "POST" })
  }, [])

  const runPsDemo = useCallback(async () => {
    const res = await fetch(`${SERVER_URL}/api/disaster/ps-demo`, { method: "POST" })
    return res.json()
  }, [])

  const runDemoMission = useCallback(async () => {
    const res = await fetch(`${SERVER_URL}/api/disaster/demo-mission`, { method: "POST" })
    return res.json()
  }, [])

  const classifyTweet = useCallback(async (text: string) => {
    const res = await fetch(`${SERVER_URL}/api/nlp/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
    return res.json()
  }, [])

  const resolveEvent = useCallback(async (eventId: string) => {
    await fetch(`${SERVER_URL}/api/disaster/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    })
  }, [])

  const resetSimulation = useCallback(async () => {
    const res = await fetch(`${SERVER_URL}/api/disaster/reset`, { method: "POST" })
    setAllocations([])
    try {
      const d = (await res.json()) as { fairnessGamma?: number }
      if (typeof d?.fairnessGamma === "number") setFairnessGammaState(d.fairnessGamma)
      const mr = await fetch(`${SERVER_URL}/api/mesh-log`)
      const mesh = (await mr.json()) as MeshLogPayload
      if (mesh?.messages) setMeshLog(mesh)
    } catch {
      /* ignore parse */
    }
  }, [])

  const setFairnessGamma = useCallback(async (gamma: number) => {
    const res = await fetch(`${SERVER_URL}/api/fairness`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fairnessGamma: gamma }),
    })
    try {
      const d = (await res.json()) as { fairnessGamma?: number }
      if (typeof d?.fairnessGamma === "number") setFairnessGammaState(d.fairnessGamma)
    } catch {
      /* ignore parse */
    }
  }, [])

  const simulateFailure = useCallback(async (agentId: string) => {
    await fetch(`${SERVER_URL}/api/disaster/simulate-failure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    })
  }, [])

  return {
    agents,
    events,
    allocations,
    powerLedger,
    negotiationLog,
    meshLog,
    crimeHotspots,
    fairnessGamma,
    setFairnessGamma,
    connected,
    blockedZones,
    triggerDisaster,
    triggerCrisis,
    triggerCascade,
    runPsDemo,
    runDemoMission,
    classifyTweet,
    resolveEvent,
    resetSimulation,
    simulateFailure,
  }
}
