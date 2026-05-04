/**
 * SafetyAlertModal — Full-screen dark modal for ride safety alerts.
 *
 * Shows when useRideMonitor detects an unexpected stop or route deviation.
 * Features a 15-second animated countdown ring, "I'm Safe" (dismiss) and
 * "Trigger SOS Now" buttons, plus a post-trigger confirmation state.
 *
 * Fully self-contained — does NOT modify or depend on CabPage SOS logic.
 */

import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, ShieldAlert, ShieldCheck, Zap, X } from "lucide-react"
import type { RideAlertType } from "../lib/useRideMonitor"

// ── Props ──────────────────────────────────────────────────────────────────

interface SafetyAlertModalProps {
  alertType: RideAlertType
  countdown: number
  onDismiss: () => void
  onTriggerSOS: () => void
  sosTriggered: boolean
}

// ── Alert config ───────────────────────────────────────────────────────────

const ALERT_CONFIG = {
  "unexpected-stop": {
    title: "Unexpected Stop Detected",
    message:
      "Your vehicle has been stationary for over 2 minutes and you are far from your destination. If you did not stop voluntarily, we will alert emergency services.",
    Icon: AlertTriangle,
    color: "#f59e0b",
  },
  "route-deviation": {
    title: "Route Deviation Detected",
    message:
      "Your vehicle has deviated more than 300 m from the expected route. If this was not intentional, we will alert emergency services.",
    Icon: ShieldAlert,
    color: "#ef4444",
  },
} as const

const COUNTDOWN_MAX = 15

// ── Component ──────────────────────────────────────────────────────────────

export default function SafetyAlertModal({
  alertType,
  countdown,
  onDismiss,
  onTriggerSOS,
  sosTriggered,
}: SafetyAlertModalProps) {
  // Nothing to render
  if (!alertType && !sosTriggered) return null

  // ── SOS Triggered confirmation ──────────────────────────────────────────
  if (sosTriggered) {
    return (
      <AnimatePresence>
        <motion.div
          key="sos-triggered"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 22, stiffness: 280 }}
            className="relative max-w-sm w-full rounded-3xl overflow-hidden"
            style={{
              background: "rgba(18,18,24,0.98)",
              border: "1px solid rgba(239,68,68,0.45)",
              boxShadow: "0 0 80px rgba(239,68,68,0.25)",
            }}
          >
            {/* Pulsing red top bar */}
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="h-1"
              style={{ background: "linear-gradient(90deg, transparent, #ef4444, transparent)" }}
            />

            <div className="p-6 text-center">
              <motion.div
                animate={{ scale: [1, 1.12, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.45)" }}
              >
                <Zap className="w-8 h-8 text-red-500" />
              </motion.div>

              <h3 className="text-red-400 font-bold text-lg mb-2">SOS Triggered</h3>
              <p className="text-[#A1A1AA] text-sm leading-relaxed mb-6">
                Emergency signal has been sent. Authorities and emergency contacts have been notified.
              </p>

              <button
                onClick={onDismiss}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white/70 border border-white/15 hover:bg-white/5 transition-all"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // ── Active alert with countdown ────────────────────────────────────────
  if (!alertType) return null
  const { title, message, Icon, color } = ALERT_CONFIG[alertType]
  const circumference = 2 * Math.PI * 34
  const progress = countdown / COUNTDOWN_MAX

  return (
    <AnimatePresence>
      <motion.div
        key="safety-alert"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
      >
        <motion.div
          initial={{ scale: 0.84, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.84, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 280 }}
          className="relative max-w-sm w-full rounded-3xl overflow-hidden"
          style={{
            background: "rgba(18,18,24,0.98)",
            border: `1px solid ${color}40`,
            boxShadow: `0 0 80px ${color}20`,
          }}
        >
          {/* Pulsing top accent bar */}
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="h-1"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          />

          {/* Close button */}
          <button
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            {/* Alert icon */}
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ background: `${color}18`, border: `2px solid ${color}40` }}
            >
              <Icon className="w-8 h-8" style={{ color }} />
            </motion.div>

            {/* Title */}
            <h3 className="text-white font-bold text-lg text-center mb-2">{title}</h3>

            {/* Message */}
            <p className="text-[#A1A1AA] text-sm text-center leading-relaxed mb-6">
              {message}
            </p>

            {/* Countdown ring */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative w-20 h-20">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                  {/* Track */}
                  <circle
                    cx="40" cy="40" r="34"
                    fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"
                  />
                  {/* Progress arc */}
                  <motion.circle
                    cx="40" cy="40" r="34"
                    fill="none"
                    stroke={color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    animate={{ strokeDashoffset: circumference * (1 - progress) }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.span
                    key={countdown}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-2xl font-black tabular-nums"
                    style={{ color }}
                  >
                    {countdown}
                  </motion.span>
                </div>
              </div>
              <p className="text-[#52525B] text-xs mt-2">
                Auto-triggering SOS in {countdown}s
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onDismiss}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  boxShadow: "0 0 24px rgba(34,197,94,0.3)",
                }}
              >
                <ShieldCheck className="w-4 h-4" />
                I'm Safe
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onTriggerSOS}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  boxShadow: "0 0 24px rgba(239,68,68,0.3)",
                }}
              >
                <Zap className="w-4 h-4" />
                Trigger SOS Now
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
