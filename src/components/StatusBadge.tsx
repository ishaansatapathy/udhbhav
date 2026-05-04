import { motion, AnimatePresence } from "framer-motion"

type Status = "ACTIVE" | "ASSIGNED" | "ESCALATED" | "RESOLVED"

const STATUS_CONFIG: Record<Status, {
    bg: string
    border: string
    text: string
    dot: string
    glow: string
    animation?: string
}> = {
    ACTIVE: {
        bg: "rgba(239,68,68,0.12)",
        border: "rgba(239,68,68,0.3)",
        text: "#f87171",
        dot: "#ef4444",
        glow: "0 0 12px rgba(239,68,68,0.25)",
        animation: "statusPulse 1.5s ease-in-out infinite",
    },
    ASSIGNED: {
        bg: "rgba(249,115,22,0.12)",
        border: "rgba(249,115,22,0.3)",
        text: "#fb923c",
        dot: "#f97316",
        glow: "0 0 12px rgba(249,115,22,0.2)",
        animation: "statusShimmer 2s ease-in-out infinite",
    },
    ESCALATED: {
        bg: "rgba(168,85,247,0.12)",
        border: "rgba(168,85,247,0.3)",
        text: "#c084fc",
        dot: "#a855f7",
        glow: "0 0 12px rgba(168,85,247,0.25)",
        animation: "statusFlash 1.2s ease-in-out infinite",
    },
    RESOLVED: {
        bg: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.3)",
        text: "#4ade80",
        dot: "#22c55e",
        glow: "0 0 12px rgba(34,197,94,0.2)",
    },
}

/**
 * StatusBadge — Animated status indicator component.
 *
 * Variants: ACTIVE, ASSIGNED, ESCALATED, RESOLVED
 * Smooth 400ms transitions between states.
 */
export default function StatusBadge({
    status,
    label,
    className = "",
}: {
    status: Status
    label?: string
    className?: string
}) {
    const config = STATUS_CONFIG[status]
    const displayLabel = label ?? status

    return (
        <AnimatePresence mode="wait">
            <motion.span
                key={status}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${className}`}
                style={{
                    background: config.bg,
                    border: `1px solid ${config.border}`,
                    color: config.text,
                    boxShadow: config.glow,
                }}
            >
                {/* Animated dot */}
                <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                        backgroundColor: config.dot,
                        animation: config.animation,
                    }}
                />
                {displayLabel}
            </motion.span>
        </AnimatePresence>
    )
}

