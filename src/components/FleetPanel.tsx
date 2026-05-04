import { motion } from "framer-motion"
import { Car, ChevronRight, Zap } from "lucide-react"
import type { FleetVehicle } from "../lib/FleetTypes"
import { getStatusColor, getStatusLabel } from "../lib/FleetTypes"

interface FleetPanelProps {
    vehicles: FleetVehicle[]
    selectedId: string | null
    onFocus: (id: string) => void
    onTriggerDeviation: (id: string) => void
}

export default function FleetPanel({ vehicles, selectedId, onFocus, onTriggerDeviation }: FleetPanelProps) {
    if (vehicles.length === 0) return null

    const activeCount = vehicles.filter(v => v.status === "ACTIVE").length
    const alertCount = vehicles.filter(v => v.status === "ALERT").length

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute bottom-32 left-4 z-[1005] w-60 rounded-2xl overflow-hidden shadow-2xl"
            style={{
                background: "rgba(10,10,15,0.95)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(59,130,246,0.3)",
            }}
        >
            {/* Header */}
            <div
                className="px-4 py-2.5 flex items-center gap-2 border-b border-blue-500/20"
                style={{ background: "linear-gradient(135deg,rgba(59,130,246,0.15),transparent)" }}
            >
                <Car className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-bold tracking-[0.15em] text-blue-300 uppercase">
                    Fleet Monitor
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                    {activeCount > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {activeCount}
                        </span>
                    )}
                    {alertCount > 0 && (
                        <motion.span
                            animate={{ opacity: [0.6, 1, 0.6] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30"
                        >
                            {alertCount}⚠
                        </motion.span>
                    )}
                </div>
            </div>

            {/* Vehicle list */}
            <div className="max-h-80 overflow-y-auto">
                {vehicles.map(v => {
                    const color = getStatusColor(v.status)
                    const isSelected = v.id === selectedId

                    return (
                        <motion.button
                            key={v.id}
                            onClick={() => onFocus(v.id)}
                            className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-white/5 transition-all hover:bg-white/5 ${isSelected ? "bg-blue-500/10" : ""
                                }`}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Status dot */}
                            <div className="relative flex-shrink-0">
                                {v.status === "ALERT" ? (
                                    <motion.div
                                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                                        transition={{ repeat: Infinity, duration: 0.8 }}
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ background: color }}
                                    />
                                ) : (
                                    <div
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ background: color, opacity: v.status === "IDLE" ? 0.5 : 1 }}
                                    />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white text-[11px] font-bold truncate">{v.id}</span>
                                    <span
                                        className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full"
                                        style={{
                                            background: `${color}22`,
                                            color: color,
                                            border: `1px solid ${color}44`,
                                        }}
                                    >
                                        {getStatusLabel(v.status)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[9px] text-[#A1A1AA] truncate">{v.label}</span>
                                    {v.activeNodeId && (
                                        <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                            📡 {v.activeNodeId}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Risk score */}
                            {v.status !== "IDLE" && (
                                <div className="flex-shrink-0 text-right">
                                    <div className="text-[10px] font-black tabular-nums" style={{ color }}>
                                        {Math.round(v.riskScore)}
                                    </div>
                                    <div className="text-[8px] text-[#52525B]">risk</div>
                                </div>
                            )}

                            <ChevronRight className="w-3 h-3 text-[#52525B] flex-shrink-0" />
                        </motion.button>
                    )
                })}
            </div>

            {/* Quick actions */}
            <div className="px-3 py-2 border-t border-white/8 flex gap-1.5">
                {vehicles
                    .filter(v => v.status === "ACTIVE")
                    .slice(0, 2)
                    .map(v => (
                        <button
                            key={v.id}
                            onClick={(e) => { e.stopPropagation(); onTriggerDeviation(v.id) }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[8px] font-bold bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all"
                            title={`Deviate ${v.id}`}
                        >
                            <Zap className="w-2.5 h-2.5" />
                            Dev {v.id}
                        </button>
                    ))}
            </div>
        </motion.div>
    )
}
