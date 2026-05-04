/**
 * SosPanel — side/inline panel shown during active SOS.
 *
 * Displays:
 *  - Status chip with human-readable text
 *  - Responder ID
 *  - ETA (minutes)
 *  - Distance from user
 */

import { motion, AnimatePresence } from "framer-motion"
import { Navigation, Clock, MapPin, UserCheck, Radio } from "lucide-react"
import type { SosState, SosStatus } from "../lib/useSosState"

interface Props {
    sosState: SosState
}

const STATUS_TEXT: Record<SosStatus, string> = {
    IDLE: "",
    SEARCHING: "Searching nearby responders...",
    ASSIGNED: "Responder assigned",
    ENROUTE: "Responder en route",
    ARRIVED: "Responder has arrived",
}

const STATUS_COLORS: Record<SosStatus, { bg: string; border: string; text: string }> = {
    IDLE:      { bg: "rgba(39,39,42,0.6)",    border: "rgba(255,255,255,0.08)", text: "#71717a" },
    SEARCHING: { bg: "rgba(234,179,8,0.08)",  border: "rgba(234,179,8,0.2)",   text: "#fbbf24" },
    ASSIGNED:  { bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", text: "#60a5fa" },
    ENROUTE:   { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)", text: "#93c5fd" },
    ARRIVED:   { bg: "rgba(34,197,94,0.08)",  border: "rgba(34,197,94,0.25)",  text: "#4ade80" },
}

function formatEta(sec: number | null): string {
    if (sec === null) return "—"
    if (sec === 0) return "Arrived"
    const min = Math.floor(sec / 60)
    const s = sec % 60
    if (min === 0) return `${s}s`
    return `${min}m ${String(s).padStart(2, "0")}s`
}

function formatDist(m: number | null): string {
    if (m === null) return "—"
    if (m === 0) return "On-site"
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`
}

export default function SosPanel({ sosState }: Props) {
    const { active, status, responder, eta, distanceM } = sosState
    if (!active || status === "IDLE") return null

    const colors = STATUS_COLORS[status]

    return (
        <AnimatePresence>
            <motion.div
                key="sos-panel"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="rounded-xl p-5 space-y-4"
                style={{
                    background: "rgba(24,24,27,0.95)",
                    border: `1px solid ${colors.border}`,
                    boxShadow: `0 0 30px ${colors.bg}`,
                }}
            >
                {/* Header row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4" style={{ color: colors.text }} />
                        <span className="text-sm font-bold text-white">Emergency Response</span>
                    </div>

                    {/* Status chip */}
                    <motion.div
                        key={status}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                        style={{
                            background: colors.bg,
                            border: `1px solid ${colors.border}`,
                            color: colors.text,
                        }}
                    >
                        {status === "SEARCHING" && <Radio className="w-3 h-3 animate-pulse" />}
                        {status === "ASSIGNED" && <UserCheck className="w-3 h-3" />}
                        {status === "ENROUTE" && <Navigation className="w-3 h-3" />}
                        {status === "ARRIVED" && <span>✓</span>}
                        {STATUS_TEXT[status]}
                    </motion.div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Responder ID */}
                    <div
                        className="rounded-lg px-3 py-2.5 space-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                        <p className="text-[10px] text-[#52525b] uppercase tracking-wider font-medium">Responder ID</p>
                        <p className="text-sm font-bold text-white font-mono">
                            {responder ? responder.id : <span className="text-[#52525b]">—</span>}
                        </p>
                    </div>

                    {/* Status */}
                    <div
                        className="rounded-lg px-3 py-2.5 space-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                        <p className="text-[10px] text-[#52525b] uppercase tracking-wider font-medium">Status</p>
                        <p className="text-sm font-bold" style={{ color: colors.text }}>{status}</p>
                    </div>

                    {/* ETA */}
                    <div
                        className="rounded-lg px-3 py-2.5 space-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                        <p className="text-[10px] text-[#52525b] uppercase tracking-wider font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ETA
                        </p>
                        <p className="text-sm font-bold text-amber-300 font-mono">{formatEta(eta)}</p>
                    </div>

                    {/* Distance */}
                    <div
                        className="rounded-lg px-3 py-2.5 space-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                        <p className="text-[10px] text-[#52525b] uppercase tracking-wider font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Distance
                        </p>
                        <p className="text-sm font-bold text-blue-300 font-mono">{formatDist(distanceM)}</p>
                    </div>
                </div>

                {/* Searching animation */}
                {status === "SEARCHING" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)" }}
                    >
                        <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="w-1.5 h-1.5 rounded-full bg-amber-400"
                                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                />
                            ))}
                        </div>
                        <span className="text-[11px] text-amber-300">Scanning for nearby emergency responders...</span>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    )
}
