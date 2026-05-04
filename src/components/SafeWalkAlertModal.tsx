/**
 * SafeWalkAlertModal — "Are you safe?" popup shown when Safe Walk status = ALERT.
 *
 * YES  → resetAlert() (back to ACTIVE)
 * NO   → triggerSOS() (existing SOS flow, not modified)
 */

import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, ShieldCheck, Siren } from "lucide-react"

interface Props {
    visible: boolean
    onYes: () => void
    onNo: () => void
}

export default function SafeWalkAlertModal({ visible, onYes, onNo }: Props) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 320, damping: 26 }}
                        className="relative w-80 rounded-2xl p-7 text-center space-y-6 shadow-2xl"
                        style={{
                            background: "linear-gradient(160deg, #1c1917 0%, #18181b 100%)",
                            border: "1px solid rgba(239,68,68,0.35)",
                            boxShadow: "0 0 60px rgba(239,68,68,0.15)",
                        }}
                    >
                        {/* Pulsing icon */}
                        <div className="flex justify-center">
                            <span className="relative flex items-center justify-center w-16 h-16 rounded-full"
                                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
                                <span className="absolute w-16 h-16 rounded-full animate-ping"
                                    style={{ background: "rgba(239,68,68,0.08)" }} />
                                <AlertTriangle className="w-8 h-8 text-red-400" />
                            </span>
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-black text-white">Are you safe?</h2>
                            <p className="text-sm text-[#a1a1aa] leading-relaxed">
                                ⚠ You have been stationary for some time.<br />
                                <span className="text-amber-300 font-medium">Your guardian has been alerted.</span>
                            </p>
                        </div>

                        <div className="flex gap-3">
                            {/* YES */}
                            <button
                                onClick={onYes}
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

                            {/* NO */}
                            <button
                                onClick={onNo}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm tracking-wide transition-all hover:brightness-110 active:scale-95"
                                style={{
                                    background: "linear-gradient(135deg, #dc2626, #991b1b)",
                                    boxShadow: "0 0 20px rgba(239,68,68,0.25)",
                                    color: "#fff",
                                }}
                            >
                                <Siren className="w-4 h-4" />
                                SOS
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
