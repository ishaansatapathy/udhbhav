import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useMultiAgent } from "../lib/useMultiAgent"
import DisasterMap from "../components/DisasterMap"
import PowerLedgerCard from "../components/PowerLedgerCard"
import NegotiationTranscriptCard from "../components/NegotiationTranscriptCard"
import MeshCommsCard from "../components/MeshCommsCard"
import StakeholderAgentsCard from "../components/StakeholderAgentsCard"
import SimulationControls from "../components/SimulationControls"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"

const SPECTACLE_SCRIPT: { delay: number; line: string }[] = [
  { delay: 200, line: "Control plane · mesh sync with 30 field agents (AMB / POL / CAB / HOSP MCI) OK" },
  { delay: 1100, line: "Incident fusion pipeline · severity matrix loaded" },
  { delay: 2100, line: "Crisis wave ARMED · floods, fires, STM32+LoRa miner-gas dual dispatch, SOS" },
  { delay: 3800, line: "Allocator · scoring top-3 candidates per hotspot (explainable weights)" },
  { delay: 5200, line: "MED / HOSP surge teams · mine events get ambulance + casualty-staging unit" },
  { delay: 7200, line: "Resilience layer · standby for breakdown + Women-SOS preemption" },
]

export default function DisasterDashboard() {
  const [, setSearchParams] = useSearchParams()
  const { agents, events, allocations, powerLedger, negotiationLog, meshLog, crimeHotspots, fairnessGamma, setFairnessGamma, connected, blockedZones, triggerDisaster, triggerCrisis, triggerCascade, runPsDemo, runDemoMission, classifyTweet, resolveEvent, resetSimulation, simulateFailure } = useMultiAgent()
  const [crimeLayerVisible, setCrimeLayerVisible] = useState(true)
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoStep, setDemoStep] = useState(0)
  const [spectacleFeed, setSpectacleFeed] = useState<string[]>([])
  const spectacleTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const idle = agents.filter(a => a.status === "idle").length
  const assigned = agents.filter(a => a.status === "assigned").length
  const busy = agents.filter(a => a.status === "busy").length
  const activeEvents = events.filter(e => e.status !== "resolved").length
  const resolved = events.filter(e => e.status === "resolved").length
  const avgScore = useMemo(() => {
    if (!allocations.length) return 0
    const total = allocations.reduce((sum, item) => sum + (item.score || 0), 0)
    return total / allocations.length
  }, [allocations])
  const responseEtaMin = useMemo(() => {
    const now = Date.now()
    const responding = events.filter(e => e.status === "responding" || e.assigned_agent)
    if (!responding.length) return 0
    const totalMs = responding.reduce((sum, e) => sum + Math.max(0, now - e.timestamp), 0)
    return totalMs / responding.length / 60000
  }, [events])
  const demoProgress = useMemo(() => Math.min(100, Math.max(0, (demoStep / 4) * 100)), [demoStep])

  useEffect(() => {
    if (!demoRunning) return
    const t1 = setTimeout(() => setDemoStep(2), 4000)
    const t2 = setTimeout(() => setDemoStep(3), 8000)
    const t3 = setTimeout(() => {
      setDemoStep(4)
      setDemoRunning(false)
    }, 12000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [demoRunning])

  const startSpectacleFeed = useCallback(() => {
    spectacleTimersRef.current.forEach(clearTimeout)
    spectacleTimersRef.current = []
    setSpectacleFeed([])
    SPECTACLE_SCRIPT.forEach(({ delay, line }) => {
      const id = setTimeout(() => {
        setSpectacleFeed((prev) => [...prev.slice(-10), line])
      }, delay)
      spectacleTimersRef.current.push(id)
    })
  }, [])

  useEffect(() => () => {
    spectacleTimersRef.current.forEach(clearTimeout)
  }, [])

  const handleRunDemoMission = useCallback(async () => {
    setDemoRunning(true)
    setDemoStep(1)
    await runDemoMission()
  }, [runDemoMission])

  const handleRunPsDemo = useCallback(async () => {
    setDemoRunning(true)
    setDemoStep(1)
    startSpectacleFeed()
    await runPsDemo()
  }, [runPsDemo, startSpectacleFeed])

  const handleResetAndRunDemo = useCallback(async () => {
    await resetSimulation()
    setDemoStep(0)
    await new Promise(resolve => setTimeout(resolve, 350))
    await handleRunDemoMission()
  }, [resetSimulation, handleRunDemoMission])

  useEffect(() => {
    if (!demoRunning && demoStep >= 4) {
      setSpectacleFeed((prev) =>
        prev.some((l) => l.startsWith("MISSION COMPLETE")) ? prev : [...prev, "MISSION COMPLETE · allocator in steady state"]
      )
    }
  }, [demoRunning, demoStep])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const flag = sp.get("demo")
    if (flag !== "1" && flag !== "true") return
    const dedupeKey = "saarthi_autodemo_recent"
    const now = Date.now()
    const prev = sessionStorage.getItem(dedupeKey)
    if (prev && now - Number(prev) < 1600) return
    sessionStorage.setItem(dedupeKey, String(now))
    startSpectacleFeed()
    setSearchParams({}, { replace: true })
    void handleResetAndRunDemo()
    // Intentionally run once on landing; query is cleared immediately after.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + initial ?demo=1 only
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Nav */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
        <div className="flex items-center gap-3">
          <span className="text-lg text-cyan-300">◈</span>
          <div>
            <div className="text-sm font-semibold tracking-wide text-slate-100">Saarthi CrisisOps</div>
            <div className="text-[10px] tracking-[0.16em] text-slate-500">MULTI-AGENT COORDINATION ENGINE</div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <Badge variant={connected ? "secondary" : "destructive"}>{connected ? "Live" : "Offline"}</Badge>
          {[
            { label: "Fleet", value: agents.length },
            { label: "Utilities", value: powerLedger?.stakeholderAgents?.length ?? "—" },
            { label: "Idle", value: idle },
            { label: "Assigned", value: assigned },
            { label: "Active", value: activeEvents },
            { label: "Resolved", value: resolved },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-lg font-semibold text-slate-100">{s.value}</div>
              <div className="text-[10px] tracking-wider text-slate-500">{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
        <a href="/" className="text-xs text-slate-400 no-underline transition-colors hover:text-slate-200">Back</a>
      </div>

      {/* Main content */}
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* Left sidebar */}
        <div className="h-full w-[340px] shrink-0 overflow-y-auto border-r border-slate-800 bg-slate-900/50 p-4">
          <SimulationControls
            agents={agents}
            fairnessGamma={fairnessGamma}
            onFairnessChange={setFairnessGamma}
            connected={connected}
            onTrigger={triggerDisaster}
            onTriggerCrisis={triggerCrisis}
            onCascadeStrike={triggerCascade}
            onRunPsDemo={handleRunPsDemo}
            onRunDemoMission={handleRunDemoMission}
            onResetAndRunDemo={handleResetAndRunDemo}
            onClassify={classifyTweet}
            onReset={resetSimulation}
            onSimulateFailure={simulateFailure}
          />
        </div>

        {/* Map */}
        <div className="relative flex-1">
          <DisasterMap
            agents={agents}
            events={events}
            stakeholders={powerLedger?.stakeholderAgents}
            blockedZones={blockedZones}
            crimeHotspots={crimeHotspots?.points ?? null}
            crimeLayerOn={crimeLayerVisible}
            onResolve={resolveEvent}
          />
          <div className="pointer-events-auto absolute bottom-14 left-4 z-520 flex max-w-sm flex-col gap-1 rounded-lg border border-slate-700/80 bg-slate-950/95 px-3 py-2 text-slate-200 shadow-lg backdrop-blur-sm">
            <label className="flex cursor-pointer items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-slate-600 accent-violet-500"
                checked={crimeLayerVisible}
                onChange={e => setCrimeLayerVisible(e.target.checked)}
              />
              <span>Show city crime roll-up (<span className="font-mono text-violet-300">{crimeHotspots?.rowCount?.toLocaleString() ?? "—"}</span> synthetic records → <span className="text-violet-300">{crimeHotspots?.cityCount ?? "—"}</span> cities)</span>
            </label>
            {crimeHotspots?.missingFile && (
              <div className="text-[10px] text-amber-400">CSV bundle missing — overlay disabled server-side.</div>
            )}
            {crimeHotspots?.disclaimer && (
              <div className="text-[9px] leading-snug text-slate-500">{crimeHotspots.disclaimer}</div>
            )}
            {crimeHotspots?.topDomainsNational && crimeHotspots.topDomainsNational.length > 0 && (
              <div className="text-[9px] leading-snug text-slate-500">
                National taxonomy roll-up (synthetic):{" "}
                {crimeHotspots.topDomainsNational.slice(0, 6).map((d, i) => (
                  <span key={`${d.domain}-${i}`}>
                    {i > 0 ? " · " : ""}
                    <span className="text-slate-400">{d.domain}</span>
                    {" "}
                    <span className="font-mono text-violet-400/90">{d.count}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {spectacleFeed.length > 0 && (
            <div className="pointer-events-none absolute bottom-5 left-5 z-600 max-w-[min(28rem,calc(100%-2.5rem))]">
              <Card className="border-cyan-800/50 bg-slate-950/95 text-slate-100 shadow-lg shadow-cyan-950/40">
                <CardHeader className="py-2 pb-0">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">
                    Live agent ops
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 px-4 pb-3 pt-1 font-mono text-[10px] leading-relaxed text-slate-300">
                  {spectacleFeed.map((line, i) => (
                    <div
                      key={`${i}-${line.slice(0, 12)}`}
                      className="border-l-2 border-cyan-500/40 pl-2 opacity-95"
                    >
                      {line}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
          <div className="pointer-events-none absolute left-4 top-4 z-500 max-w-56">
            <Card className="border-slate-700 bg-slate-950/90 text-slate-100 shadow-sm">
              <CardContent className="px-4 py-3">
                <div className="text-xs font-semibold text-cyan-300">Demo Mission Progress</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {demoStep <= 1 && "1) Crisis wave initiated"}
                  {demoStep === 2 && "2) Vehicle breakdown + reassignment"}
                  {demoStep >= 3 && "3) Women SOS priority dispatch"}
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-slate-800">
                  <div className="h-full rounded bg-cyan-400 transition-all duration-500" style={{ width: `${demoProgress}%` }} />
                </div>
                {demoRunning && <div className="mt-1 text-[11px] text-emerald-400">Running...</div>}
                {!demoRunning && demoStep >= 4 && <div className="mt-1 text-[11px] text-emerald-400">Mission complete</div>}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right sidebar — allocation feed */}
        <div className="h-full w-[360px] shrink-0 space-y-3 overflow-y-auto border-l border-slate-800 bg-slate-900/50 p-4">
          <PowerLedgerCard snapshot={powerLedger} />
          <StakeholderAgentsCard stakeholders={powerLedger?.stakeholderAgents} />
          <NegotiationTranscriptCard payload={negotiationLog} />
          <MeshCommsCard payload={meshLog} />
          <Card className="border-slate-700 bg-slate-950 text-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Mission Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-xs text-slate-400">Track the most recent allocation decisions and score rationale.</div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-md border border-slate-700 bg-slate-900 p-2">
                  <div className="text-[10px] text-slate-500">Avg Allocation Score</div>
                  <div className="text-sm font-semibold text-emerald-300">{avgScore.toFixed(2)}</div>
                </div>
                <div className="rounded-md border border-slate-700 bg-slate-900 p-2">
                  <div className="text-[10px] text-slate-500">Response ETA Estimate</div>
                  <div className="text-sm font-semibold text-cyan-300">{responseEtaMin.toFixed(1)} min</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-950 text-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Judge walkthrough (~2 min) + runbook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] text-slate-400">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Live flow (say while clicking)</div>
              <ol className="ml-4 list-decimal space-y-1.5 leading-snug">
                <li>
                  <span className="text-slate-300">0:00–0:20 · Setup</span> — Confirm <span className="text-cyan-300">Live</span> badge; mention single browser tab is enough. If something looks stale after a backend restart, hard-refresh once; <span className="text-slate-300">Reset</span> clears simulation + mesh but not the CSV research layer.
                </li>
                <li>
                  <span className="text-slate-300">0:20–0:45 · Research context</span> — Toggle <span className="text-violet-300">city crime roll-up</span> on the map: aggregated counts from bundled CSV at city centroids only (no victim data, not a live police feed).
                </li>
                <li>
                  <span className="text-slate-300">0:45–1:15 · Stress the grid</span> — <span className="font-semibold text-emerald-300">Run PS Demo</span> or <span className="text-emerald-300">Crisis</span> + <span className="text-rose-300">Cascade</span>; read <span className="text-amber-200">power ledger</span> + <span className="text-violet-200">negotiation</span> + <span className="text-cyan-200">mesh comms</span> together as “control room audio + formal transcript.”
                </li>
                <li>
                  <span className="text-slate-300">1:15–1:50 · Allocator</span> — Point to dispatch cards / explain γ <span className="font-mono text-teal-300">{fairnessGamma.toFixed(2)}</span>; nudge the fairness slider once and show <span className="text-teal-200">Mesh comms → Policy</span> for the γ line. Optional <span className="text-slate-300">Simulate failure</span> for re-allocation.
                </li>
                <li>
                  <span className="text-slate-300">1:50–2:00 · Close</span> — KPIs: avg score <span className="font-mono text-emerald-300">{avgScore.toFixed(2)}</span>, ETA <span className="font-mono text-cyan-300">{responseEtaMin.toFixed(1)} min</span>.
                </li>
              </ol>
              <div className="border-t border-slate-800 pt-2 text-[10px] uppercase tracking-wider text-slate-500">90s condensed</div>
              <div className="space-y-1.5 leading-snug">
                <div>
                  1) <span className="font-semibold text-emerald-300">Run PS Demo</span> → crisis then cascade while MW is tight.
                </div>
                <div>
                  2) <span className="text-amber-200">Power ledger</span>{" "}
                  <span className="font-mono text-amber-200">{powerLedger?.availableMW?.toFixed?.(1) ?? "—"} MW</span> avail /{" "}
                  <span className="font-mono text-red-300">{powerLedger?.unservedMW?.toFixed?.(1) ?? "—"}</span> unserved /{" "}
                  <span className="font-mono text-amber-200">{powerLedger?.blackoutRiskPct?.toFixed?.(1) ?? "—"}%</span> blackout pressure.
                </div>
                <div>3) <span className="text-indigo-200">Utility nodes</span> on map + <span className="text-violet-200">negotiation transcript</span>.{" "}
                  {powerLedger?.cascadeActive ? (
                    <span className="text-rose-300">Cascade ON.</span>
                  ) : (
                    <span className="text-slate-500">Cascade idle until strike.</span>
                  )}
                </div>
                <div>
                  4) <span className="text-cyan-200">Mesh comms</span> filter (Grid / Utility / Dispatch) for operator chatter alongside the formal log.
                </div>
                <div>
                  5) Allocator + <span className="font-mono text-teal-300">γ {fairnessGamma.toFixed(2)}</span> (slider → mesh <span className="text-teal-200">Policy</span> tab); KPIs{" "}
                  <span className="font-mono text-emerald-300">{avgScore.toFixed(2)}</span> /{" "}
                  <span className="font-mono text-cyan-300">{responseEtaMin.toFixed(1)} min</span>.
                </div>
              </div>
            </CardContent>
          </Card>

          {allocations.length === 0 && (
            <div className="mt-2 text-center text-xs text-slate-600">
              No allocations yet.<br />Trigger a disaster to begin.
            </div>
          )}
          {allocations.map((a, i) => (
            <Card key={i} className="border-emerald-800/40 bg-emerald-950/20 text-slate-100 shadow-sm">
              <CardContent className="space-y-1 px-4 py-3">
                <div className="text-xs font-semibold text-emerald-300">Allocated</div>
                <div className="text-xs text-slate-300">Agent: {a.agentId}</div>
                <div className="text-xs text-slate-300">Event: {a.eventId}</div>
                {a.score && <div className="text-[11px] text-slate-500">Score: {a.score.toFixed(3)}</div>}
                {a.candidates && a.candidates.length > 0 && (
                <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                  {a.candidates[0].score_rationale ? (
                    <div className="leading-snug text-slate-400">{a.candidates[0].score_rationale}</div>
                  ) : (
                    <div>
                      Why: Sev {a.candidates[0].severity} x Wt {a.candidates[0].priority_weight} / D {a.candidates[0].effective_distance_km.toFixed(2)}
                    </div>
                  )}
                  {fairnessGamma > 0.02 &&
                    typeof a.candidates[0].fairness_multiplier === "number" &&
                    typeof a.candidates[0].impact_multiplier === "number" && (
                    <div className="text-[10px] text-teal-500/90">
                      Composite: fair×{a.candidates[0].fairness_multiplier.toFixed(2)} · impact×{a.candidates[0].impact_multiplier.toFixed(2)} · γ{' '}
                      {fairnessGamma.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
              </CardContent>
            </Card>
          ))}

          <Card className="border-slate-700 bg-slate-950 text-slate-100 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Active Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
          {events.filter(e => e.status !== "resolved").map(ev => (
            <div key={ev.id} className={`rounded-md border p-2 ${ev.priority === "CRITICAL" ? "border-pink-700/40 bg-pink-950/20" : "border-red-800/40 bg-red-950/20"}`}>
              <div className={`text-xs font-semibold ${ev.priority === "CRITICAL" ? "text-pink-300" : "text-red-300"}`}>
                {ev.type.replace(/_/g, " ").toUpperCase()}
              </div>
              <div className="text-[11px] text-slate-500">Sev {ev.severity}/10 · ~{ev.casualties_est} casualties</div>
              <div className="text-[11px] text-emerald-400">
                {ev.assigned_agent ? `Primary (scene): ${ev.assigned_agent}` : "Awaiting assignment"}
              </div>
              {(ev.secondary_assignments?.length ?? 0) > 0 && (
                <div className="mt-1 space-y-0.5 text-[10px] text-violet-300">
                  {ev.secondary_assignments!.map(s => (
                    <div key={s.agentId}>Also: {s.agentId} — {s.role}</div>
                  ))}
                </div>
              )}
              {ev.sensor_meta?.readings?.length ? (
                <div className="mt-1 text-[10px] text-amber-200/90">
                  LoRa/STM32 hint: {ev.sensor_meta.readings.join(" · ")}
                </div>
              ) : null}
              {ev.allocation_explain && ev.allocation_explain.length > 0 && (
                <div className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                  <div>
                    Top match: {ev.allocation_explain[0].agentId} ({ev.allocation_explain[0].type}) ·{' '}
                    {ev.allocation_explain[0].score.toFixed(2)}
                  </div>
                  {ev.allocation_explain[0].score_rationale ? (
                    <div className="text-[10px] leading-snug text-slate-400">{ev.allocation_explain[0].score_rationale}</div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
