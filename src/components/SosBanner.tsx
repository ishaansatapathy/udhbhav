/**
 * SosBanner — full-width top alert banner shown when SOS is active.
 * Shows the pulsing "🚨 Emergency Mode Active" header + escalation notice.
 */

import { motion, AnimatePresence } from "framer-motion"
import type { SosState } from "../lib/useSosState"

interface Props {
    sosState: SosState
    onCancel?: () => void
}

export default function SosBanner({ sosState, onCancel }: Props) {
    if (!sosState.active) return null

    return (
        <AnimatePresence>
            <motion.div
                key="sos-banner"
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className="fixed top-0 left-0 right-0 z-[9998]"
                style={{
                    background: "linear-gradient(90deg, #7f1d1d 0%, #991b1b 40%, #7f1d1d 100%)",
                    borderBottom: "1px solid rgba(239,68,68,0.4)",
                    boxShadow: "0 4px 32px rgba(239,68,68,0.25)",
                }}
            >
                <div className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-3">
                        {/* Pulsing dot */}
                        <span className="relative flex h-3 w-3">
                            <span
                                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                style={{ backgroundColor: "#fca5a5" }}
                            />
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400" />
                        </span>

                        <span className="text-white font-black text-sm tracking-wide">
                            🚨 Emergency Mode Active
                        </span>

                        <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                            style={{
                                background: "rgba(255,255,255,0.12)",
                                color: "#fca5a5",
                                border: "1px solid rgba(255,255,255,0.15)",
                            }}
                        >
                            {sosState.status}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Escalation message */}
                        <AnimatePresence>
                            {sosState.escalated && (
                                <motion.span
                                    initial={{ opacity: 0, x: 12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-[11px] font-semibold text-amber-300 flex items-center gap-1"
                                >
                                    ⚡ Alert escalated to safety network
                                </motion.span>
                            )}
                        </AnimatePresence>

                        {onCancel && sosState.status === "ARRIVED" && (
                            <button
                                onClick={onCancel}
                                className="text-[11px] text-white/60 hover:text-white/90 transition-colors underline underline-offset-2"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    )
}
