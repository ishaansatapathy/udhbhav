import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import type { MeshLogPayload } from "../lib/useMultiAgent"

interface Props {
  payload: MeshLogPayload | null
}

type MeshFilterTab = "all" | "grid" | "utility" | "allocation" | "policy"

const tabTone: Record<Exclude<MeshFilterTab, "all">, string> = {
  grid: "border-sky-600/55 text-sky-200",
  utility: "border-amber-600/50 text-amber-200",
  allocation: "border-emerald-600/55 text-emerald-200",
  policy: "border-teal-600/50 text-teal-200",
}

function matchesTab(m: { channel: string; role: string }, tab: MeshFilterTab) {
  if (tab === "all") return true
  const ch = m.channel.toLowerCase()
  const rl = m.role.toLowerCase()
  if (tab === "grid") return ch === "power" || ch === "cascade" || rl === "grid"
  if (tab === "utility") return ch === "utility" || rl === "utility"
  if (tab === "policy") return ch === "policy"
  return ch === "allocation" || rl === "operator"
}

export default function MeshCommsCard({ payload }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<MeshFilterTab>("all")

  const filtered = useMemo(() => {
    const list = payload?.messages ?? []
    if (tab === "all") return list
    return list.filter((m) => matchesTab(m, tab))
  }, [payload?.messages, tab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [filtered.length, payload?.updatedAt, tab])

  const empty = !payload || payload.messages.length === 0

  return (
    <Card className="border-cyan-900/45 bg-slate-950 text-slate-100 shadow-sm">
      <CardHeader className="space-y-2 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-cyan-200">Mesh comms</CardTitle>
          {!empty && (
            <span className="text-[10px] text-slate-500">
              {payload.messages.length} lines · {new Date(payload.updatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <p className="text-[11px] leading-snug text-slate-500">
          Live operator + utility chatter (grid posture, allocations, cascade, policy γ).
        </p>
        <div className="flex flex-wrap gap-1">
          {(["all", "grid", "utility", "allocation", "policy"] as MeshFilterTab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`rounded border px-2 py-0.5 text-[10px] capitalize transition-colors ${tab === t ? "border-cyan-500/70 bg-slate-800 text-cyan-100" : "border-slate-700 text-slate-400 hover:border-slate-600"}`}
              onClick={() => setTab(t)}
            >
              {t === "allocation" ? "Dispatch" : t === "policy" ? "Policy" : t}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        {empty ? (
          <div className="text-xs text-slate-500">
            Waiting for interconnect ticks or allocations — mesh fills as the simulation runs.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-slate-500">No lines in this filter.</div>
        ) : (
          <div className="max-h-[min(40vh,320px)] space-y-2 overflow-y-auto rounded-md border border-slate-800/80 bg-slate-950/80 p-2">
            {[...filtered].reverse().map((m) => {
              const badgeClass =
                m.channel === "policy"
                  ? tabTone.policy
                  : m.channel === "utility"
                    ? tabTone.utility
                    : m.channel === "allocation"
                      ? tabTone.allocation
                      : m.channel === "power" || m.channel === "cascade"
                        ? tabTone.grid
                        : "border-slate-600 text-slate-400"
              return (
                <div
                  key={m.id}
                  className="rounded border border-slate-800/60 bg-slate-900/45 px-2.5 py-2 text-[11px] leading-relaxed"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={`h-5 border px-1.5 py-0 text-[10px] ${badgeClass}`}>
                      {m.channel}
                    </Badge>
                    <span className="font-medium text-cyan-100/90">{m.speaker}</span>
                    <span className="text-[10px] text-slate-500">{new Date(m.ts).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-300/95">{m.body}</div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
