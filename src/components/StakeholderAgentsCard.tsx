import { Badge } from "./ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { UtilityStakeholderAgent } from "../lib/useMultiAgent"

interface Props {
  stakeholders: UtilityStakeholderAgent[] | null | undefined
}

const STATUS_LABEL: Record<UtilityStakeholderAgent["status"], string> = {
  nominal: "Nominal",
  stressed: "Stressed",
  load_shedding: "Shed risk",
  mandate_breach: "Mandate breach",
}

const STATUS_CLASS: Record<UtilityStakeholderAgent["status"], string> = {
  nominal: "border-sky-800/60 text-sky-200/95",
  stressed: "border-amber-800/55 text-amber-200",
  load_shedding: "border-orange-800/50 text-orange-200",
  mandate_breach: "border-red-800/55 text-red-200",
}

export default function StakeholderAgentsCard({ stakeholders }: Props) {
  if (!stakeholders?.length) {
    return (
      <Card className="border-indigo-900/45 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-indigo-200">Utility stakeholder agents</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">
          Loading interconnect personas — named utilities that negotiate MW, then steer fleet-capable responders.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-indigo-900/45 bg-slate-950 text-slate-100 shadow-sm">
      <CardHeader className="space-y-0.5 pb-2">
        <CardTitle className="text-sm font-semibold text-indigo-200">
          Utility stakeholder agents <span className="text-[10px] font-normal text-slate-500">(not fleet units)</span>
        </CardTitle>
        <p className="text-[11px] leading-snug text-slate-500">
          Autonomous load negotiators anchored on the map; field ambulances / police / hospitals execute their finalized posture.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {stakeholders.map(s => (
          <div
            key={s.id}
            className="rounded-md border border-slate-800/80 bg-slate-900/55 px-2.5 py-2 transition-colors duration-700"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-indigo-300">{s.shortCode}</span>
                  <span className="text-[11px] font-semibold leading-snug text-slate-200">{s.label}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-400">{s.objective}</p>
              </div>
              <Badge variant="outline" className={`h-6 shrink-0 border px-1.5 text-[10px] ${STATUS_CLASS[s.status]}`}>
                {STATUS_LABEL[s.status]}
              </Badge>
            </div>
            <div className="mt-1.5 rounded border border-slate-800/60 bg-slate-950/50 px-2 py-1 text-[10px] leading-relaxed text-slate-500">
              <span className="font-medium text-slate-400">Mandate — </span>
              {s.mandate}
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-violet-300/85">
              <span className="text-slate-500">Fleet bridge — </span>
              {s.fleetBridge}
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-500">
              MW {s.allocatedMW.toFixed(1)} / {s.requestedMW.toFixed(1)} · min {s.minMW.toFixed(1)}
              {s.shortfallMW > 0.05 ? <span className="text-red-400"> · shortfall {s.shortfallMW.toFixed(1)}</span> : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
