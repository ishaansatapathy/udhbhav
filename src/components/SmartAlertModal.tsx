/**
 * SmartAlertModal — "Unusual Activity Detected" popup.
 *
 * Shown proactively BEFORE SOS when suspicious movement is detected.
 *
 * YES, I'm Safe  → dismiss
 * NO, I Need Help → escalate to SOS
 */

import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, ShieldCheck, Siren } from "lucide-react"
import type { SmartAlertState, SmartAlertTrigger } from "../lib/useSmartAlert"

interface Props {
    alertState: SmartAlertState
    messages: Record<SmartAlertTrigger, string>
    onSafe: () => void
    onHelp: () => void
}

const TRIGGER_ICONS: Record<SmartAlertTrigger, string> = {
    DEVIATION: "🛤️",
    STOP: "⏸️",
    HIGH_RISK_ZONE: "🔴",
}

export default function SmartAlertModal({ alertState, messages, onSafe, onHelp }: Props) {
    const { visible, triggeredBy } = alertState

    return (
        <AnimatePresence>
            {visible && triggeredBy && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 320, damping: 26 }}
                        className="relative w-[340px] rounded-2xl p-7 text-center space-y-5 shadow-2xl"
                        style={{
                            background: "linear-gradient(160deg, #1c1917 0%, #18181b 100%)",
                            border: "1px solid rgba(234,179,8,0.35)",
                            boxShadow: "0 0 60px rgba(234,179,8,0.12)",
                        }}
                    >
                        {/* Pulsing icon */}
                        <div className="flex justify-center">
                            <span className="relative flex items-center justify-center w-16 h-16 rounded-full"
                                style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.3)" }}>
                                <span className="absolute w-16 h-16 rounded-full animate-ping"
                                    style={{ background: "rgba(234,179,8,0.06)" }} />
                                <AlertTriangle className="w-8 h-8 text-amber-400" />
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-lg font-black text-white">⚠ Unusual Activity Detected</h2>

                            {/* Trigger type badge */}
                            <div
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                style={{
                                    background: "rgba(234,179,8,0.08)",
                                    border: "1px solid rgba(234,179,8,0.2)",
                                    color: "#fbbf24",
                                }}
                            >
                                <span>{TRIGGER_ICONS[triggeredBy]}</span>
                                {triggeredBy.replace(/_/g, " ")}
                            </div>

                            <p className="text-sm text-[#a1a1aa] leading-relaxed mt-2">
                                {messages[triggeredBy]}
                            </p>
                        </div>

                        <div className="flex gap-3 pt-1">
                            {/* Safe */}
                            <button
                                onClick={onSafe}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:brightness-110 active:scale-95"
                                style={{
                                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                    boxShadow: "0 0 20px rgba(34,197,94,0.25)",
                                    color: "#fff",
                                }}
                            >
                                <ShieldCheck className="w-4 h-4" />
                                I'm Safe
                            </button>

                            {/* Need Help */}
                            <button
                                onClick={onHelp}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:brightness-110 active:scale-95"
                                style={{
                                    background: "linear-gradient(135deg, #dc2626, #991b1b)",
                                    boxShadow: "0 0 20px rgba(239,68,68,0.25)",
                                    color: "#fff",
                                }}
                            >
                                <Siren className="w-4 h-4" />
                                Need Help
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
