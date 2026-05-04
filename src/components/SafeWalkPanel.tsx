/**
 * SafeWalkPanel — Guardian status panel shown while Safe Walk is active.
 *
 * Displays:
 *  - Status chip: SAFE (green) or ATTENTION REQUIRED (red)
 *  - Last known lat/lng
 *  - Live green indicator dot
 *  - Guardian Connected badge
 */

import { motion, AnimatePresence } from "framer-motion"
import { ShieldCheck, MapPin, Radio, Wifi } from "lucide-react"
import type { SafeWalkState } from "../lib/useSafeWalkState"

interface Props {
    state: SafeWalkState
}

export default function SafeWalkPanel({ state }: Props) {
    const { active, status, currentLocation, lastMoveTime, guardianConnected } = state

    if (!active || status === "IDLE") return null

    const isAlert = status === "ALERT"

    const statusLabel = isAlert ? "ATTENTION REQUIRED" : "SAFE"
    const statusColors = isAlert
        ? { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", text: "#f87171" }
        : { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)", text: "#4ade80" }

    const elapsed = lastMoveTime ? Math.round((Date.now() - lastMoveTime) / 1000) : null

    return (
        <AnimatePresence>
            <motion.div
                key="safewalk-panel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ type: "spring", stiffness: 280, damping: 26 }}
                className="rounded-xl p-5 space-y-4"
                style={{
                    background: "rgba(24,24,27,0.95)",
                    border: `1px solid ${statusColors.border}`,
                    boxShadow: `0 0 30px ${statusColors.bg}`,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold text-white">Guardian Panel</span>
                    </div>

                    {/* Status chip */}
                    <motion.div
                        key={status}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                        style={{
                            background: statusColors.bg,
                            border: `1px solid ${statusColors.border}`,
                            color: statusColors.text,
                        }}
                    >
                        {/* Pulsing dot */}
                        <span className="relative flex h-2 w-2">
                            <span
                                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                                style={{ backgroundColor: statusColors.text }}
                            />
                            <span
                                className="relative inline-flex rounded-full h-2 w-2"
                                style={{ backgroundColor: statusColors.text }}
                            />
                        </span>
                        {statusLabel}
                    </motion.div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Location */}
                    <div className="col-span-2 rounded-lg px-3 py-2.5 space-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[10px] text-[#52525b] uppercase tracking-wider font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> Last Known Location
                        </p>
                        <p className="text-sm font-bold text-white font-mono">
                            {currentLocation
                                ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}`
                                : <span className="text-[#52525b]">Acquiring…</span>
                            }
                        </p>
                    </div>

                    {/* Last moved */}
                    <div className="rounded-lg px-3 py-2.5 space-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[10px] text-[#52525b] uppercase tracking-wider font-medium">Last Move</p>
                        <p className="text-sm font-bold text-amber-300 font-mono">
                            {elapsed !== null ? `${elapsed}s ago` : "—"}
                        </p>
                    </div>

                    {/* Guardian */}
                    <div className="rounded-lg px-3 py-2.5 space-y-1"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="text-[10px] text-[#52525b] uppercase tracking-wider font-medium flex items-center gap-1">
                            <Wifi className="w-3 h-3" /> Guardian
                        </p>
                        <p className="text-sm font-bold flex items-center gap-1.5"
                            style={{ color: guardianConnected ? "#4ade80" : "#f87171" }}>
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {guardianConnected ? "Connected" : "Offline"}
                        </p>
                    </div>
                </div>

                {/* Alert banner */}
                <AnimatePresence>
                    {isAlert && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg overflow-hidden"
                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
                        >
                            <span className="text-red-400 text-sm">⚠</span>
                            <span className="text-xs text-red-300 font-medium">You have been stationary for some time</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    )
}
