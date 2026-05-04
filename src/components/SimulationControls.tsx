import { useState } from "react"
import { Agent } from "../lib/useMultiAgent"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Textarea } from "./ui/textarea"
import { Separator } from "./ui/separator"
import { Flame, Siren, Waves, Mountain, FlaskConical, Building2, Factory, RadioTower, Zap } from "lucide-react"

interface Props {
  agents: Agent[]
  fairnessGamma: number
  onFairnessChange: (gamma: number) => void | Promise<void>
  onTrigger: (type: string) => void
  onTriggerCrisis: () => void
  onCascadeStrike: () => void | Promise<void>
  onRunPsDemo: () => Promise<any>
  onRunDemoMission: () => Promise<any>
  onResetAndRunDemo: () => Promise<void>
  onClassify: (text: string) => Promise<any>
  onReset: () => void
  onSimulateFailure: (agentId: string) => void
  connected: boolean
}

const DISASTERS = [
  { type: "flood", label: "Flood", icon: Waves },
  { type: "earthquake", label: "Earthquake", icon: Building2 },
  { type: "fire", label: "Fire", icon: Flame },
  { type: "chemical_leak", label: "Chemical Leak", icon: FlaskConical },
  { type: "mine_collapse", label: "Mine Collapse", icon: Mountain },
  { type: "mine_gas_lora", label: "Miner Gas · LoRa/STM32", icon: RadioTower },
  { type: "women_sos", label: "Women SOS", icon: Siren },
  { type: "industrial_hazard", label: "Industrial Hazard", icon: Factory },
]

export default function SimulationControls({
  agents,
  fairnessGamma,
  onFairnessChange,
  onTrigger,
  onTriggerCrisis,
  onCascadeStrike,
  onRunPsDemo,
  onRunDemoMission,
  onResetAndRunDemo,
  onClassify,
  onReset,
  onSimulateFailure,
  connected,
}: Props) {
  const [tweet, setTweet] = useState("")
  const [nlpResult, setNlpResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function handleClassify() {
    if (!tweet.trim()) return
    setLoading(true)
    try {
      const result = await onClassify(tweet)
      setNlpResult(result)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card className="border-slate-700/50 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            System Link
            <Badge variant={connected ? "secondary" : "destructive"}>
              {connected ? "Live Connected" : "Disconnected"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs leading-relaxed text-slate-400">
          Command center syncs allocator, telemetry, six named{' '}
          <span className="text-indigo-300/90">utility stakeholder agents</span> (MW posture + fleet bridge),{' '}
          plus the{' '}
          <span className="text-amber-400/90">interconnect power ledger</span> and negotiation transcript.
        </CardContent>
      </Card>

      <Card className="border-teal-900/35 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-teal-200">Fairness × system impact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed text-slate-400">
          <p>
            <span className="text-teal-300/95">γ</span> spreads duty across responders vs pure greedy proximity; many concurrent incidents mildly lift middling hotspots so corridors do not silently starve.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <span className="w-10 shrink-0 font-mono text-[11px] text-teal-300">{fairnessGamma.toFixed(2)}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(fairnessGamma * 100)}
              onChange={e => {
                void onFairnessChange(Number(e.target.value) / 100)
              }}
              className="h-2 w-full flex-1 cursor-pointer accent-teal-500"
              aria-label="Allocator fairness gamma"
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>γ = 0 greedy</span>
            <span>γ = 1 strong blend</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-700/50 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Disaster Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {DISASTERS.map(d => (
              <Button
                key={d.type}
                onClick={() => onTrigger(d.type)}
                variant="outline"
                className="justify-start border-slate-700 bg-slate-900 text-xs text-slate-200 hover:border-slate-500 hover:bg-slate-800"
              >
                <d.icon className="h-3.5 w-3.5" />
                {d.label}
              </Button>
            ))}
          </div>
          <Separator className="bg-slate-700/60" />
          <Button onClick={onTriggerCrisis} className="w-full bg-slate-100 font-semibold text-slate-950 hover:bg-white">
            Trigger Crisis Wave
          </Button>
          <Button
            onClick={() => void onCascadeStrike()}
            variant="outline"
            className="w-full justify-center gap-2 border-rose-900/55 bg-rose-950/30 font-semibold text-rose-100 hover:border-rose-700 hover:bg-rose-950/50"
          >
            <Zap className="h-3.5 w-3.5 shrink-0" />
            Cascade strike
          </Button>
          <Button onClick={onRunPsDemo} className="w-full bg-emerald-500 font-semibold text-slate-950 hover:bg-emerald-400">
            Run PS Demo (crisis → cascade)
          </Button>
          <Button onClick={onRunDemoMission} variant="secondary" className="w-full bg-cyan-700 text-white hover:bg-cyan-600">
            Run 3-Step Demo Mission
          </Button>
          <Button onClick={onResetAndRunDemo} variant="outline" className="w-full border-cyan-700/60 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/50">
            Demo Reset + Start
          </Button>
          <div className="text-[11px] leading-relaxed text-slate-500">
            <span className="text-rose-300/90">Cascade</span> stacks interconnect damage + EQ/industrial pair — ledger & transcript re-seat before slow decay.
            {" "}
            <span className="text-cyan-400/90">Chemical leak (toxic gas / hazmat)</span>, miner gas LoRa/STM32, and mine collapse spawn{" "}
            <span className="text-cyan-400/90">ambulance + hospital (MCI surge)</span> pairs. Then try vehicle breakdown + Women SOS.
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-700/50 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tweet Classifier</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
          value={tweet}
          onChange={e => setTweet(e.target.value)}
          placeholder="e.g. STM32 + LoRa methane spike in tunnel B2 — evacuate miners..."
          rows={3}
          className="resize-none border-white/15 bg-slate-900/80 text-xs text-white placeholder:text-slate-500"
        />
        <Button onClick={handleClassify} disabled={loading || !tweet.trim()} className="mt-2 w-full bg-violet-700 hover:bg-violet-600">
          {loading ? "Classifying..." : "Classify & Auto-Allocate"}
        </Button>
        {nlpResult && (
          <div className="mt-2 rounded-md border border-slate-700 bg-slate-900 p-2">
            <div className={`text-xs font-bold ${nlpResult.label === "disaster" ? "text-red-400" : "text-emerald-400"}`}>
              {nlpResult.label === "disaster" ? "Disaster Detected" : "Non-Disaster"}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Confidence: {(nlpResult.confidence * 100).toFixed(0)}% | Type: {nlpResult.disaster_type || "N/A"}
              {nlpResult.event_created && <span className="text-orange-400"> | Event auto-created!</span>}
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      <Card className="border-slate-700/50 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Stress Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={() => {
          const assignedAgents = agents.filter(a => a.status === "assigned")
          if (assignedAgents.length > 0) {
            const randomAgent = assignedAgents[Math.floor(Math.random() * assignedAgents.length)]
            onSimulateFailure(randomAgent.id)
          } else {
            alert("No agents are currently assigned to fail!")
          }
          }} variant="outline" className="w-full border-amber-700/50 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50">
          Simulate Vehicle Breakdown
          </Button>
          <Button onClick={onReset} variant="destructive" className="w-full">
            Reset Simulation
          </Button>
          <Separator className="bg-slate-700/60" />
          <div className="space-y-1 text-[11px] text-slate-400">
            <div className="font-medium text-slate-300">Legend</div>
            {["Ambulance", "Police", "Hospital (MCI surge)", "Cab"].map((l) => (
              <div key={l} className="flex items-center gap-2">
                <span>{l}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
