import { motion } from "framer-motion"

/**
 * TacticalCard — Reusable glassmorphism card for the tactical UI.
 *
 * Features:
 * - bg-white/5 + backdrop-blur
 * - border-white/10
 * - rounded-2xl + shadow-xl
 * - Hover: lift, glow border, shadow intensifies
 * - 300ms smooth transitions
 */
export default function TacticalCard({
    children,
    className = "",
    hoverable = true,
    glow = false,
    glowColor = "rgba(124,58,237,0.15)",
    padding = "p-5",
    animate = true,
}: {
    children: React.ReactNode
    className?: string
    hoverable?: boolean
    glow?: boolean
    glowColor?: string
    padding?: string
    animate?: boolean
}) {
    const Wrapper = animate ? motion.div : "div"
    const animProps = animate
        ? {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.35, ease: "easeOut" },
        }
        : {}

    return (
        <Wrapper
            {...(animProps as any)}
            className={`
        ${padding} rounded-2xl
        bg-white/[0.04] backdrop-blur-xl
        border border-white/[0.08]
        shadow-xl
        ${hoverable ? "tactical-card" : ""}
        ${className}
      `}
            style={glow ? { boxShadow: `0 0 24px ${glowColor}` } : undefined}
        >
            {children}
        </Wrapper>
    )
}
