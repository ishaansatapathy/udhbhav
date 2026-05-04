import { Link, useLocation } from "react-router-dom"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { animate, stagger } from "animejs"

const NAV_LINKS = [
    { to: "/wallet", label: "Wallet" },
    { to: "/cab", label: "Cab" },
    { to: "/police", label: "Police" },
    { to: "/emergency", label: "Emergency" },
]

/**
 * TacticalNav — Award-winning premium navigation.
 *
 * Features:
 * - Multi-layer glassmorphism backdrop
 * - Animated gradient glow border
 * - Anime.js brand entrance with letter stagger
 * - Framer Motion active-route indicator pill
 * - Smooth scroll-aware opacity transitions
 * - Premium hover micro-interactions
 */
export default function TacticalNav() {
    const location = useLocation()
    const [scrolled, setScrolled] = useState(false)
    const brandRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 30)
        window.addEventListener("scroll", fn)
        return () => window.removeEventListener("scroll", fn)
    }, [])

    // Anime.js brand entrance — cinematic with blur
    useEffect(() => {
        if (!brandRef.current) return
        const letters = brandRef.current.querySelectorAll('.brand-letter')
        const icon = brandRef.current.querySelector('.brand-icon')
        if (letters.length > 0) {
            animate(letters, {
                opacity: [0, 1],
                translateY: [-24, 0],
                filter: ["blur(6px)", "blur(0px)"],
                duration: 550,
                delay: stagger(50, { start: 300 }),
                ease: 'out(4)',
            })
        }
        if (icon) {
            animate(icon, {
                opacity: [0, 1],
                scale: [0.2, 1],
                rotate: [-120, 0],
                filter: ["blur(8px)", "blur(0px)"],
                duration: 700,
                delay: 100,
                ease: 'out(3)',
            })
        }
    }, [])

    const navRef = useRef<HTMLElement>(null)

    // Anime.js nav links entrance
    useEffect(() => {
        if (!navRef.current) return
        const links = navRef.current.querySelectorAll('.nav-link-tactical')
        if (links.length > 0) {
            animate(links, {
                opacity: [0, 1],
                translateY: [-12, 0],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 400,
                delay: stagger(60, { start: 500 }),
                ease: 'out(3)',
            })
        }
    }, [])

    return (
        <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${scrolled
                ? "bg-black/70 backdrop-blur-2xl shadow-2xl"
                : "bg-white/2 backdrop-blur-lg"
                }`}
            style={{
                borderBottom: scrolled
                    ? "1px solid rgba(124,58,237,0.12)"
                    : "1px solid rgba(255,255,255,0.04)",
            }}
        >
            {/* Bottom glow line */}
            <div
                className="absolute bottom-0 left-0 right-0 h-px transition-opacity duration-700"
                style={{
                    background: "linear-gradient(90deg, transparent 2%, rgba(124,58,237,0.5) 25%, rgba(99,102,241,0.4) 50%, rgba(124,58,237,0.5) 75%, transparent 98%)",
                    opacity: scrolled ? 0.9 : 0.25,
                }}
            />

            {/* Top subtle light */}
            <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                    opacity: scrolled ? 0 : 1,
                }}
            />

            <div className="px-6 md:px-12 py-3.5 flex items-center justify-between max-w-360 mx-auto">
                {/* Brand */}
                <Link to="/" className="flex items-center gap-2 group">
                    <div ref={brandRef} className="flex items-center gap-2.5">
                        <motion.div 
                            className="brand-icon w-8 h-8 flex items-center justify-center transition-all duration-400"
                            whileHover={{ rotate: 15, scale: 1.1 }}
                            style={{ opacity: 0 }}>
                            <img src="/morpankh.png" alt="Saarthi" className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]" />
                        </motion.div>
                        <span className="text-white font-bold text-sm tracking-[0.18em] uppercase group-hover:text-[#a78bfa] transition-colors duration-400">
                            {"SAARTHI".split("").map((ch, i) => (
                                <span key={i} className="brand-letter inline-block" style={{ opacity: 0 }}>
                                    {ch}
                                </span>
                            ))}
                        </span>
                    </div>
                </Link>

                {/* Navigation links */}
                <nav ref={navRef} className="flex items-center gap-1 md:gap-1.5">
                    {NAV_LINKS.map(({ to, label }) => {
                        const isActive = location.pathname === to
                        const isEmergency = to === "/emergency"

                        return (
                            <Link
                                key={to}
                                to={to}
                                className={`nav-link-tactical relative px-3.5 py-2 rounded-lg text-[11px] font-semibold tracking-[0.14em] uppercase transition-all duration-400
                  ${isActive
                                        ? "text-white active"
                                        : isEmergency
                                            ? "text-red-400/70 hover:text-red-300"
                                            : "text-white/30 hover:text-white/85 hover:bg-white/4"
                                    }
                  hover:scale-[1.04]
                `}
                            >
                                {label}
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-active"
                                        className="absolute inset-0 rounded-lg -z-10"
                                        style={{
                                            background: isEmergency
                                                ? "rgba(220,38,38,0.12)"
                                                : "rgba(124,58,237,0.12)",
                                            border: `1px solid ${isEmergency ? "rgba(220,38,38,0.25)" : "rgba(124,58,237,0.25)"}`,
                                            boxShadow: isEmergency
                                                ? "0 0 12px rgba(220,38,38,0.1)"
                                                : "0 0 12px rgba(124,58,237,0.08)",
                                        }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </Link>
                        )
                    })}
                </nav>
            </div>
        </motion.header>
    )
}

