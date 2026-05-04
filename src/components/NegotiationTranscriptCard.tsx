import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import type { NegotiationLogPayload } from "../lib/useMultiAgent"

interface Props {
  payload: NegotiationLogPayload | null
}

const phaseTone: Record<string, string> = {
  open: "border-slate-600 text-slate-300",
  call: "border-sky-700/50 text-sky-200/90",
  bid: "border-violet-700/50 text-violet-200/90",
  counter: "border-amber-700/50 text-amber-200/90",
  revise: "border-cyan-700/50 text-cyan-200/90",
  finalize: "border-emerald-700/50 text-emerald-200/90",
  system: "border-slate-600 text-slate-400",
  cascade: "border-rose-800/55 text-rose-200/90",
}

function roundLabel(r: number) {
  if (r <= 0) return "Intro"
  return `Round ${r}`
}

export default function NegotiationTranscriptCard({ payload }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  if (!payload || payload.lines.length === 0) {
    return (
      <Card className="border-violet-900/40 bg-slate-950 text-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-violet-200">Negotiation transcript</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-slate-500">
          Waiting for interconnect settlement ticks (multi-round bids → grid counter-offers → finalize).
        </CardContent>
      </Card>
    )
  }

  const linesSorted = [...payload.lines].reverse()

  return (
    <Card className="border-violet-900/40 bg-slate-950 text-slate-100 shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-violet-200">Negotiation transcript</CardTitle>
          <span className="text-[10px] text-slate-500">
            {payload.lines.length} lines · updated {new Date(payload.updatedAt).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-[11px] leading-snug text-slate-500">
          Utility MW bids, grid counter-offers, and final dispatch — new sessions appear at the bottom as the ledger shifts.
        </p>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto rounded-md border border-slate-800/80 bg-slate-950/80 p-2">
          {linesSorted.map((ln) => (
            <div
              key={ln.id}
              className="rounded border border-slate-800/60 bg-slate-900/40 px-2.5 py-2 text-[11px] leading-relaxed"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={`h-5 border px-1.5 py-0 text-[10px] ${phaseTone[ln.phase] ?? "border-slate-600 text-slate-400"}`}>
                  {roundLabel(ln.round)} · {ln.phase}
                </Badge>
                <span className="font-medium text-violet-100/95">{ln.speaker}</span>
              </div>
              <div className="text-slate-300/95">{ln.body}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
