import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import type { PowerLedgerSnapshot } from "../lib/useMultiAgent"

interface Props {
  snapshot: PowerLedgerSnapshot | null
}

export default function PowerLedgerCard({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <Card className="border-amber-800/60 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-amber-200">Interconnect power ledger</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">Loading grid snapshot…</CardContent>
      </Card>
    )
  }

  const {
    nominalMW,
    availableMW,
    utilities,
    sumRequested,
    unservedMW,
    blackoutRiskPct,
    servedMW,
    stressIndex,
    baseStressIndex,
    cascadeActive,
    cascadeResidualStress,
    cascadeStrikeCount,
    derateFactor,
    loadPctOfCapacity,
  } = snapshot

  const utilPct = (u: typeof utilities[0]) =>
    Math.min(100, (u.allocatedMW / Math.max(0.001, u.requestedMW)) * 100)

  const riskTone =
    blackoutRiskPct >= 55 ? "text-red-400" :
      blackoutRiskPct >= 28 ? "text-amber-300" :
        "text-emerald-400"

  return (
    <Card className="border-amber-800/60 bg-slate-950 text-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-amber-200">
          Interconnect power ledger <span className="text-[10px] font-normal text-slate-500">(PS — scarcity)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {cascadeActive ? (
          <div className="rounded-md border border-rose-800/55 bg-rose-950/40 px-3 py-2 text-[11px] leading-snug text-rose-100/95">
            <span className="font-semibold text-rose-200">Cascade layer · </span>
            +{(cascadeResidualStress ?? 0).toFixed(1)} interconnect stress-eq layered on incidents
            {typeof cascadeStrikeCount === "number" ? ` (wave #${cascadeStrikeCount})` : ""}. Ledger + transcript re-seat — softer loads shed first until decay.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-slate-700 bg-slate-900 p-2">
            <div className="text-[10px] text-slate-500">Available now</div>
            <div className="font-mono text-lg font-semibold tabular-nums text-amber-200">{availableMW} <span className="text-xs text-slate-500">MW</span></div>
            <div className="text-[9px] text-slate-500">Nominal ceiling {nominalMW} MW</div>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900 p-2">
            <div className="text-[10px] text-slate-500">Portfolio demand</div>
            <div className="font-mono text-lg font-semibold tabular-nums text-slate-100">{sumRequested} <span className="text-xs text-slate-500">MW</span></div>
            <div className="text-[9px] text-slate-500">Load vs nominal {(loadPctOfCapacity).toFixed(0)}%</div>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900 p-2">
            <div className="text-[10px] text-slate-500">Unserved</div>
            <div className={`font-mono text-lg font-semibold tabular-nums ${unservedMW > 2 ? "text-red-400" : "text-slate-300"}`}>
              {unservedMW} <span className="text-xs text-slate-500">MW</span>
            </div>
            <div className="text-[9px] text-slate-500">Served {servedMW} MW allocated</div>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900 p-2">
            <div className="text-[10px] text-slate-500">Blackout pressure</div>
            <div className={`font-mono text-lg font-semibold tabular-nums ${riskTone}`}>
              {blackoutRiskPct}<span className="text-sm">%</span>
            </div>
            <div className="text-[9px] text-slate-500">
              Stress {stressIndex}
              {typeof baseStressIndex === "number" ? ` · incidents-only ${baseStressIndex}` : ""}
              {' '}· avail×{derateFactor}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Interconnect portfolio · MW</div>
          {utilities.map(u => (
            <div key={u.id} className="rounded border border-slate-800/80 bg-slate-900/60 px-2 py-1.5">
              <div className="flex items-start justify-between gap-1">
                <span className="text-[11px] font-medium leading-tight text-slate-300">{u.label}</span>
                <span className="shrink-0 font-mono text-[10px] text-slate-400">
                  {u.allocatedMW.toFixed(1)}/{u.requestedMW.toFixed(1)}{" "}
                  <span className="text-slate-600">MW</span>
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-slate-800">
                <div
                  className={`h-full rounded transition-all duration-700 ${utilPct(u) < 72 ? "bg-red-600" : utilPct(u) < 92 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${utilPct(u)}%` }}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-[9px] text-slate-600">
                <span>min {u.minMW} MW · crit {(u.criticality * 100).toFixed(0)}%</span>
                {u.shortfallMW > 0.05 ? <span className="text-red-400">short −{u.shortfallMW.toFixed(1)}</span> : <span className="text-emerald-700">met</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
