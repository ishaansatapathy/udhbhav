import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    ShieldAlert, Phone, Radio, MapPin,
    Eye, Activity, ChevronDown, Check,
    Footprints, AlertTriangle, Clock,
    Zap, Send, Users, UserCheck, Loader,
    Car, Camera, Upload, CheckCircle2, FileWarning,
} from "lucide-react"
import LiveResponseSimulation from "../components/LiveResponseSimulation"
import TrustedContacts from "../components/TrustedContacts"
import TacticalLayout from "../components/TacticalLayout"
import TacticalNav from "../components/TacticalNav"
import {
    useEmergencyEntrance,
    useSOSPulseRings,
    animateTimelineStep,
    triggerSOSShockwave,
} from "../lib/useAnimeAnimations"

const API_BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000"

const CATEGORIES = [
    { value: "PERSONAL_THREAT", label: "Personal Threat", icon: "🛡️" },
    { value: "MEDICAL_EMERGENCY", label: "Medical Emergency", icon: "🏥" },
    { value: "HARASSMENT", label: "Harassment", icon: "⚠️" },
    { value: "SUSPICIOUS_ACTIVITY", label: "Suspicious Activity", icon: "👁️" },
]

// ── Simulation timeline step definitions ────────────────────────────────────

interface SimStep {
    id: string
    label: string
    icon: React.ReactNode
    status: "pending" | "active" | "done"
    detail?: string
}

const STEP_DEFS: { id: string; label: string; icon: React.ReactNode; delayMs: number; detail?: string }[] = [
    { id: "gps", label: "GPS Location Acquired", icon: <MapPin className="w-3.5 h-3.5" />, delayMs: 500 },
    { id: "packet", label: "Emergency Packet Generated", icon: <Zap className="w-3.5 h-3.5" />, delayMs: 1000 },
    { id: "central", label: "Sent to Central Command", icon: <Send className="w-3.5 h-3.5" />, delayMs: 1500 },
    { id: "community", label: "Community Responders Notified", icon: <Users className="w-3.5 h-3.5" />, delayMs: 2000, detail: "3 nearby" },
    { id: "waiting", label: "Waiting for responder acceptance…", icon: <Loader className="w-3.5 h-3.5" />, delayMs: 3000 },
    { id: "assigned", label: "Responder Assigned", icon: <UserCheck className="w-3.5 h-3.5" />, delayMs: 6000, detail: "Arjun Kumar • 1.2 km away" },
]

// ── Haversine distance in metres ────────────────────────────────────────────
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(b.lat - a.lat)
    const dLng = toRad(b.lng - a.lng)
    const sinLat = Math.sin(dLat / 2)
    const sinLng = Math.sin(dLng / 2)
    const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

export default function PersonalEmergency() {
    const [category, setCategory] = useState(CATEGORIES[0].value)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [safeWalk, setSafeWalk] = useState(false)
    const [sending, setSending] = useState(false)
    const [confirmation, setConfirmation] = useState<string | null>(null)
    const [holdProgress, setHoldProgress] = useState(0)
    const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number } | null>(null)
    const [walkPoints, setWalkPoints] = useState(0)
    const [stopAlertVisible, setStopAlertVisible] = useState(false)
    const [stopCountdown, setStopCountdown] = useState(15)

    // ── Suspicious Activity Report state ──
    const [vehicleNumber, setVehicleNumber] = useState("")
    const [activityDesc, setActivityDesc] = useState("")
    const [vehicleImage, setVehicleImage] = useState<string | null>(null)
    const [vehicleImageName, setVehicleImageName] = useState("")
    const [vehicleSubmitting, setVehicleSubmitting] = useState(false)
    const [vehicleSuccess, setVehicleSuccess] = useState(false)

    // ── Simulation timeline state ────────────────────────────────────────────
    const [simActive, setSimActive] = useState(false)
    const [simSteps, setSimSteps] = useState<SimStep[]>([])
    const [escalationSec, setEscalationSec] = useState(120) // 2 minutes
    const [responderAssigned, setResponderAssigned] = useState(false)
    const simTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const escalationRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const holdStartRef = useRef<number>(0)
    const walkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ── Safe Walk stop-detection refs ──
    const lastMovementTsRef = useRef(0)
    const lastWalkPosRef = useRef<{ lat: number; lng: number } | null>(null)
    const watchIdRef = useRef<number | null>(null)
    const stopCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const sosFiredRef = useRef(false)
    const stopAlertRef = useRef(false)

    // ── Anime.js hooks ──────────────────────────────────────────────────────
    const emergencyRef = useEmergencyEntrance()
    const sosPulseRef = useSOSPulseRings(!sending)
    const sosButtonRef = useRef<HTMLButtonElement>(null)
    const timelineContainerRef = useRef<HTMLDivElement>(null)

    // ── GPS simulation ──────────────────────────────────────────────────────────

    useEffect(() => {
        // Try real geolocation, fallback to simulated
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setGpsPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setGpsPos({ lat: 12.9716 + (Math.random() - 0.5) * 0.01, lng: 77.5946 + (Math.random() - 0.5) * 0.01 })
            )
        } else {
            setGpsPos({ lat: 12.9716, lng: 77.5946 })
        }
    }, [])

    // ── Safe Walk Mode — Stop Detection ─────────────────────────────────────────

    useEffect(() => {
        if (!safeWalk) {
            // Full cleanup
            if (walkIntervalRef.current) { clearInterval(walkIntervalRef.current); walkIntervalRef.current = null }
            if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
            if (stopCheckRef.current) { clearInterval(stopCheckRef.current); stopCheckRef.current = null }
            if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
            setWalkPoints(0)
            setStopAlertVisible(false)
            setStopCountdown(15)
            stopAlertRef.current = false
            sosFiredRef.current = false
            lastWalkPosRef.current = null
            lastMovementTsRef.current = 0
            return
        }

        // ── Initialise refs ──
        lastMovementTsRef.current = Date.now()
        sosFiredRef.current = false
        stopAlertRef.current = false
        lastWalkPosRef.current = gpsPos ? { ...gpsPos } : { lat: 12.9716, lng: 77.5946 }

        /** Update tracking state for every position sample */
        const processPosition = (pos: { lat: number; lng: number }) => {
            setGpsPos(pos)
            setWalkPoints(p => p + 1)
            if (lastWalkPosRef.current) {
                const dist = haversineMeters(lastWalkPosRef.current, pos)
                if (dist > 10) {
                    lastMovementTsRef.current = Date.now()
                    lastWalkPosRef.current = { ...pos }
                }
            } else {
                lastWalkPosRef.current = { ...pos }
                lastMovementTsRef.current = Date.now()
            }
        }

        /** Simulated GPS drift fallback (when real geolocation unavailable) */
        const startDriftFallback = () => {
            walkIntervalRef.current = setInterval(() => {
                const prev = lastWalkPosRef.current ?? { lat: 12.9716, lng: 77.5946 }
                processPosition({
                    lat: prev.lat + (Math.random() - 0.5) * 0.0003,
                    lng: prev.lng + (Math.random() - 0.5) * 0.0003,
                })
            }, 3000)
        }

        // ── Geolocation watchPosition or fallback ──
        if (navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (p) => processPosition({ lat: p.coords.latitude, lng: p.coords.longitude }),
                () => startDriftFallback(),
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
            )
        } else {
            startDriftFallback()
        }

        // ── Stop-detection interval (every 10 s) ──
        stopCheckRef.current = setInterval(() => {
            if (stopAlertRef.current || sosFiredRef.current) return
            if (Date.now() - lastMovementTsRef.current >= 120_000) {
                stopAlertRef.current = true
                setStopAlertVisible(true)
                setStopCountdown(15)
            }
        }, 10_000)

        return () => {
            if (walkIntervalRef.current) { clearInterval(walkIntervalRef.current); walkIntervalRef.current = null }
            if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
            if (stopCheckRef.current) { clearInterval(stopCheckRef.current); stopCheckRef.current = null }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [safeWalk])

    // ── Silent trigger: hold 'V' for 3 seconds ─────────────────────────────────

    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            if (e.key === "v" || e.key === "V") {
                if (holdStartRef.current) return // already held
                holdStartRef.current = Date.now()
                holdTimerRef.current = setInterval(() => {
                    const elapsed = Date.now() - holdStartRef.current
                    const pct = Math.min(100, (elapsed / 3000) * 100)
                    setHoldProgress(pct)
                    if (elapsed >= 3000) {
                        triggerEmergency()
                        resetHold()
                    }
                }, 50)
            }
        }
        const onUp = (e: KeyboardEvent) => {
            if (e.key === "v" || e.key === "V") resetHold()
        }
        const resetHold = () => {
            if (holdTimerRef.current) clearInterval(holdTimerRef.current)
            holdTimerRef.current = null
            holdStartRef.current = 0
            setHoldProgress(0)
        }

        window.addEventListener("keydown", onDown)
        window.addEventListener("keyup", onUp)
        return () => {
            window.removeEventListener("keydown", onDown)
            window.removeEventListener("keyup", onUp)
            resetHold()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gpsPos, category])

    // ── Trigger emergency ───────────────────────────────────────────────────────

    // ── Start simulation timeline ────────────────────────────────────────────

    const startSimulation = useCallback(() => {
        // Clear previous
        simTimersRef.current.forEach(t => clearTimeout(t))
        simTimersRef.current = []
        if (escalationRef.current) clearInterval(escalationRef.current)

        setResponderAssigned(false)
        setEscalationSec(120)
        setSimActive(true)

        // Init all steps as pending
        const initial: SimStep[] = STEP_DEFS.map(s => ({ id: s.id, label: s.label, icon: s.icon, status: "pending" as const, detail: s.detail }))
        setSimSteps(initial)

        // Schedule each step
        STEP_DEFS.forEach((def, idx) => {
            const timer = setTimeout(() => {
                setSimSteps(prev => prev.map((s, i) => {
                    if (i < idx) return { ...s, status: "done" }
                    if (i === idx) return { ...s, status: "done" }
                    if (i === idx + 1) return { ...s, status: "active" }
                    return s
                }))

                // Anime.js: animate the timeline step entrance
                if (timelineContainerRef.current) {
                    animateTimelineStep(timelineContainerRef.current, idx)
                }

                // On responder assigned, stop escalation
                if (def.id === "assigned") {
                    setResponderAssigned(true)
                }
            }, def.delayMs)
            simTimersRef.current.push(timer)
        })

        // Start escalation countdown
        escalationRef.current = setInterval(() => {
            setEscalationSec(prev => {
                if (prev <= 0) return 0
                return prev - 1
            })
        }, 1000)
    }, [])

    // Pause escalation when responder assigned
    useEffect(() => {
        if (responderAssigned && escalationRef.current) {
            clearInterval(escalationRef.current)
            escalationRef.current = null
        }
    }, [responderAssigned])

    // Cleanup sim timers
    useEffect(() => {
        return () => {
            simTimersRef.current.forEach(t => clearTimeout(t))
            if (escalationRef.current) clearInterval(escalationRef.current)
        }
    }, [])

    const triggerEmergency = useCallback(async () => {
        if (sending) return
        setSending(true)

        // Anime.js shockwave on the SOS button
        if (sosButtonRef.current) {
            triggerSOSShockwave(sosButtonRef.current.parentElement as HTMLElement)
        }

        const lat = gpsPos?.lat ?? 12.9716
        const lng = gpsPos?.lng ?? 77.5946

        try {
            const resp = await fetch(`${API_BASE}/api/sos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: `user_${Date.now()}`,
                    lat, lng,
                    level: "HIGH",
                    category,
                }),
            })
            const data = await resp.json()
            if (data.ok) {
                setConfirmation(`Emergency Signal Sent`)
                startSimulation()
            } else {
                setConfirmation("Failed — Server did not acknowledge")
            }
        } catch {
            setConfirmation("Failed — Could not reach server")
        } finally {
            setSending(false)
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)
            confirmTimeoutRef.current = setTimeout(() => setConfirmation(null), 4000)
        }
    }, [sending, gpsPos, category, startSimulation])

    // ── Cleanup ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)
        }
    }, [])

    // ── Stop-Alert Countdown (15 s → auto SOS) ─────────────────────────────────

    useEffect(() => {
        if (!stopAlertVisible || !safeWalk) {
            if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
            return
        }
        let count = 15
        setStopCountdown(15)
        countdownTimerRef.current = setInterval(() => {
            count -= 1
            setStopCountdown(count)
            if (count <= 0) {
                if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
                if (!sosFiredRef.current) {
                    sosFiredRef.current = true
                    triggerEmergency()
                }
                stopAlertRef.current = false
                setStopAlertVisible(false)
            }
        }, 1000)
        return () => {
            if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
        }
    }, [stopAlertVisible, safeWalk, triggerEmergency])

    /** Dismiss the stop-detection alert and reset timers */
    const dismissStopAlert = useCallback(() => {
        stopAlertRef.current = false
        setStopAlertVisible(false)
        setStopCountdown(15)
        lastMovementTsRef.current = Date.now()
        sosFiredRef.current = false
        if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null }
    }, [])

    /** Demo: force the stop alert for testing */
    const forceStopAlert = useCallback(() => {
        if (stopAlertRef.current || sosFiredRef.current || !safeWalk) return
        stopAlertRef.current = true
        setStopAlertVisible(true)
        setStopCountdown(15)
    }, [safeWalk])

    const selectedCat = CATEGORIES.find(c => c.value === category)!

    // Format escalation countdown
    const escMin = Math.floor(escalationSec / 60)
    const escSec = escalationSec % 60
    const escDisplay = `${String(escMin).padStart(2, "0")}:${String(escSec).padStart(2, "0")}`

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <TacticalLayout>
            <TacticalNav />

            {/* ── Safe Walk Stop Detection Alert Modal ─────────────────── */}
            <AnimatePresence>
                {stopAlertVisible && safeWalk && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            className="relative w-80 rounded-2xl bg-[#18181b] border border-amber-500/30 p-6 text-center space-y-5 shadow-2xl"
                        >
                            {/* Countdown ring */}
                            <div className="mx-auto w-24 h-24 relative">
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                    <circle cx="50" cy="50" r="44" fill="none" stroke="#27272a" strokeWidth="6" />
                                    <circle
                                        cx="50" cy="50" r="44" fill="none"
                                        stroke={stopCountdown <= 5 ? "#ef4444" : "#f59e0b"}
                                        strokeWidth="6"
                                        strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 44}
                                        strokeDashoffset={2 * Math.PI * 44 * (1 - stopCountdown / 15)}
                                        className="transition-all duration-1000 ease-linear"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={`text-2xl font-black font-mono ${stopCountdown <= 5 ? "text-red-400" : "text-amber-400"}`}>
                                        {stopCountdown}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                    Movement Stopped
                                </h3>
                                <p className="text-sm text-[#a1a1aa]">
                                    We detected you haven't moved in 2 minutes.<br />
                                    <span className="text-amber-300 font-medium">SOS will trigger automatically if you don't respond.</span>
                                </p>
                            </div>

                            <button
                                onClick={dismissStopAlert}
                                className="w-full py-3 rounded-xl font-bold text-sm tracking-wide uppercase transition-all hover:brightness-110"
                                style={{
                                    background: "linear-gradient(135deg, #22c55e, #16a34a)",
                                    boxShadow: "0 0 20px rgba(34,197,94,0.3)",
                                    color: "#fff",
                                }}
                            >
                                I'm Safe
                            </button>
                            <p className="text-[10px] text-[#52525b]">
                                Auto-SOS in {stopCountdown}s if no response
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div ref={emergencyRef} className="relative z-10 max-w-2xl mx-auto px-6 py-8 space-y-8 pt-20">

                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="emer-badge inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold tracking-widest uppercase" style={{ opacity: 0 }}>
                        <ShieldAlert className="w-3 h-3" />
                        Personal Emergency
                    </div>
                    <h1 className="emer-title text-3xl font-black tracking-tight text-white" style={{ opacity: 0 }}>Emergency Response</h1>
                    <p className="emer-subtitle text-[#71717a] text-sm" style={{ opacity: 0 }}>Instant SOS for walking, public spaces, and personal safety</p>
                </div>

                {/* GPS Location Badge */}
                <div className="emer-gps flex justify-center" style={{ opacity: 0 }}>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg tactical-card text-xs" style={{ padding: "6px 12px" }}>
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        <span className="text-[#a1a1aa]">
                            {gpsPos ? `${gpsPos.lat.toFixed(4)}, ${gpsPos.lng.toFixed(4)}` : "Locating..."}
                        </span>
                        <div className={`w-1.5 h-1.5 rounded-full ${gpsPos ? "bg-emerald-400" : "bg-yellow-400 animate-pulse"}`} />
                    </div>
                </div>

                {/* ── Category Selector ────────────────────────────────────────── */}
                <div className={`emer-category relative ${dropdownOpen ? "z-50" : ""}`} style={{ opacity: 0 }}>
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl tactical-card text-sm"
                        style={{ padding: "12px 16px" }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{selectedCat.icon}</span>
                            <span className="text-white font-medium">{selectedCat.label}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-[#71717a] transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    <AnimatePresence>
                        {dropdownOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                className="absolute top-full left-0 right-0 mt-1 rounded-xl bg-white/6 backdrop-blur-2xl border border-white/10 overflow-hidden z-30 shadow-2xl"
                            >
                                {CATEGORIES.map(c => (
                                    <button
                                        key={c.value}
                                        onClick={() => { setCategory(c.value); setDropdownOpen(false) }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-white/5 transition-colors ${category === c.value ? "bg-red-500/8 text-white" : "text-[#a1a1aa]"
                                            }`}
                                    >
                                        <span className="text-lg">{c.icon}</span>
                                        <span>{c.label}</span>
                                        {category === c.value && <Check className="w-3.5 h-3.5 text-red-400 ml-auto" />}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── SOS Button ──────────────────────────────────────────────── */}
                <div className="emer-sos-btn flex justify-center py-4" style={{ opacity: 0 }}>
                    <div ref={sosPulseRef} className="relative">
                        <motion.button
                            ref={sosButtonRef}
                            onClick={triggerEmergency}
                            disabled={sending}
                            whileTap={{ scale: 0.92 }}
                            className="sos-btn-core relative w-44 h-44 rounded-full flex flex-col items-center justify-center gap-2 transition-all focus:outline-none disabled:opacity-60"
                            style={{
                                background: "radial-gradient(circle at 35% 35%, #dc2626, #991b1b 70%)",
                                boxShadow: "0 0 60px rgba(239,68,68,0.25), 0 0 120px rgba(239,68,68,0.1), inset 0 -4px 12px rgba(0,0,0,0.3)",
                            }}
                        >
                            {/* Anime.js managed pulse rings */}
                            <div className="sos-ring-inner absolute inset-0 rounded-full border-2 border-red-400" />
                            <div className="sos-ring-outer absolute -inset-3 rounded-full border border-red-500/30" />
                            <Phone className="w-10 h-10 text-white drop-shadow-lg" />
                            <span className="text-white text-sm font-black tracking-wider uppercase">
                                {sending ? "Sending..." : "Trigger Emergency"}
                            </span>
                        </motion.button>
                    </div>
                </div>

                {/* ── Confirmation ────────────────────────────────────────────── */}
                <AnimatePresence>
                    {confirmation && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl mx-auto w-fit text-sm font-medium"
                            style={{
                                background: confirmation.startsWith("Emergency")
                                    ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                border: confirmation.startsWith("Emergency")
                                    ? "1px solid rgba(34,197,94,0.25)" : "1px solid rgba(239,68,68,0.25)",
                                color: confirmation.startsWith("Emergency") ? "#22c55e" : "#ef4444",
                            }}
                        >
                            {confirmation.startsWith("Emergency") ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            {confirmation}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Live Emergency Activity Panel ──────────────────────────── */}
                <AnimatePresence>
                    {simActive && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                            className="tactical-card rounded-xl p-5 space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-emerald-400" />
                                    <span className="text-sm font-bold text-white">Live Emergency Activity</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold"
                                    style={{
                                        background: responderAssigned ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                                        border: responderAssigned ? "1px solid rgba(34,197,94,0.2)" : "1px solid rgba(239,68,68,0.2)",
                                        color: responderAssigned ? "#22c55e" : "#ef4444",
                                    }}
                                >
                                    <Clock className="w-3 h-3" />
                                    {responderAssigned
                                        ? "Escalation Paused – Responder Engaged"
                                        : `Auto Escalation in ${escDisplay}`
                                    }
                                </div>
                            </div>

                            {/* Timeline */}
                            <div ref={timelineContainerRef} className="space-y-0">
                                {simSteps.map((step, i) => {
                                    const isDone = step.status === "done"
                                    const isActive = step.status === "active"
                                    const isPending = step.status === "pending"
                                    const isWaiting = step.id === "waiting" && isDone && !responderAssigned

                                    let dotColor = "bg-[#3f3f46]" // pending
                                    let textColor = "text-[#52525b]"
                                    let lineColor = "bg-[#27272a]"

                                    if (isDone) {
                                        dotColor = step.id === "waiting" && !responderAssigned ? "bg-amber-400" : "bg-emerald-400"
                                        textColor = "text-white"
                                        lineColor = "bg-emerald-500/30"
                                    } else if (isActive) {
                                        dotColor = "bg-amber-400 animate-pulse"
                                        textColor = "text-amber-300"
                                    }

                                    return (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: isDone || isActive ? 1 : 0.35, x: 0 }}
                                            transition={{ delay: isPending ? 0 : 0.1, duration: 0.3 }}
                                            className="timeline-step flex items-start gap-3 relative"
                                        >
                                            {/* Vertical line + dot */}
                                            <div className="flex w-5 shrink-0 flex-col items-center">
                                                <div className={`step-dot w-2.5 h-2.5 rounded-full mt-1 ${dotColor} transition-colors`} />
                                                {i < simSteps.length - 1 && (
                                                    <div className={`step-line w-px h-7 ${isDone ? lineColor : "bg-[#27272a]"} transition-colors`} style={{ transformOrigin: "top" }} />
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="pb-3">
                                                <div className={`step-label flex items-center gap-1.5 text-xs font-medium ${textColor} transition-colors`}>
                                                    <span className={isDone ? "text-emerald-400" : isActive ? "text-amber-400" : "text-[#3f3f46]"}>
                                                        {isDone ? "✔" : isActive || isWaiting ? "⏳" : "○"}
                                                    </span>
                                                    {step.label}
                                                </div>
                                                {step.detail && isDone && (
                                                    <motion.div
                                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                                        className="step-detail text-[10px] text-[#71717a] mt-0.5 ml-5"
                                                    >
                                                        {step.detail}
                                                    </motion.div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Live Response Tracking ────────────────────────────────── */}
                <AnimatePresence>
                    {simActive && responderAssigned && gpsPos && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                        >
                            <LiveResponseSimulation
                                userLat={gpsPos.lat}
                                userLng={gpsPos.lng}
                                active={responderAssigned}
                                responderName="Arjun Kumar"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Trusted Contacts ────────────────────────────────────── */}
                <TrustedContacts />

                {/* ── Silent Trigger ──────────────────────────────────────────── */}
                <div className="emer-panel tactical-card rounded-xl p-5 space-y-3" style={{ opacity: 0 }}>
                    <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-amber-400" />
                        <span className="text-sm font-bold text-white">Silent Trigger</span>
                    </div>
                    <p className="text-[#71717a] text-xs leading-relaxed">
                        Hold the <kbd className="px-1.5 py-0.5 rounded bg-white/6 border border-white/10 text-white font-mono text-[10px]">V</kbd> key
                        for 3 seconds to simulate volume-button SOS trigger.
                    </p>
                    {holdProgress > 0 && (
                        <div className="space-y-1">
                            <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${holdProgress}%`,
                                        background: holdProgress < 70 ? "#f59e0b" : "#ef4444",
                                    }}
                                />
                            </div>
                            <p className="text-[10px] text-amber-400 text-center font-mono">
                                {holdProgress < 100 ? `Holding... ${Math.floor(holdProgress)}%` : "TRIGGERED"}
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Safe Walk Mode ──────────────────────────────────────────── */}
                <div className="emer-panel tactical-card rounded-xl p-5" style={{ opacity: 0 }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Footprints className="w-5 h-5 text-blue-400" />
                            <div>
                                <span className="text-sm font-bold text-white">Safe Walk Mode</span>
                                <p className="text-[10px] text-[#71717a] mt-0.5">Periodic GPS tracking for walking safety</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSafeWalk(!safeWalk)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${safeWalk ? "bg-blue-500" : "bg-[#3f3f46]"
                                }`}
                        >
                            <motion.div
                                animate={{ x: safeWalk ? 24 : 2 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                            />
                        </button>
                    </div>
                    <AnimatePresence>
                        {safeWalk && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-4 flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-500/8 border border-blue-500/15">
                                    <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                                    <span className="text-xs text-blue-300 font-medium">Safe Walk Active</span>
                                    <span className="ml-auto text-[10px] text-blue-400/60 font-mono">{walkPoints} pts tracked</span>
                                </div>
                                <button
                                    onClick={forceStopAlert}
                                    className="mt-2 w-full px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                                >
                                    🧪 Simulate Stop Detection
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── Info ────────────────────────────────────────────────────── */}
                <div className="emer-panel flex items-start gap-3 px-4 py-3 rounded-xl tactical-card text-[#52525b] text-[11px]" style={{ opacity: 0, padding: "12px 16px" }}>
                    <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        All emergency signals are routed to the centralized SOS backend and broadcast to nearby community responders and police stations in real-time.
                    </span>
                </div>
                {/* ── Report Suspicious Activity ────────────────────────────────── */}
                <div className="emer-panel tactical-card rounded-xl p-5 space-y-4" style={{ opacity: 0 }}>
                    <div className="flex items-center gap-2">
                        <FileWarning className="w-5 h-5 text-orange-400" />
                        <span className="text-sm font-bold text-white">Report Suspicious Activity</span>
                    </div>
                    <p className="text-[10px] text-[#71717a] leading-relaxed">
                        Report any suspicious activity — vehicles, persons, or incidents. Include details, photos, and optional vehicle numbers for police intelligence tracking.
                    </p>

                    {/* Description */}
                    <textarea
                        placeholder="Describe the suspicious activity..."
                        value={activityDesc}
                        onChange={e => setActivityDesc(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs
                            placeholder:text-[#52525b] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all resize-none"
                    />

                    {/* Vehicle Number (optional) */}
                    <div className="relative">
                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525b]" />
                        <input
                            type="text"
                            placeholder="Vehicle number — optional (e.g. KA01AB1234)"
                            value={vehicleNumber}
                            onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-white text-xs
                                placeholder:text-[#52525b] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all font-mono tracking-wider"
                        />
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/10
                            text-xs text-[#a1a1aa] cursor-pointer hover:bg-white/6 hover:border-orange-500/30 transition-all">
                            <Camera className="w-3.5 h-3.5 text-orange-400" />
                            {vehicleImageName || "Upload evidence photo (optional)"}
                            <Upload className="w-3 h-3 ml-auto text-[#52525b]" />
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    setVehicleImageName(file.name)
                                    const reader = new FileReader()
                                    reader.onload = () => setVehicleImage(reader.result as string)
                                    reader.readAsDataURL(file)
                                }}
                            />
                        </label>
                        {vehicleImage && (
                            <div className="mt-2 rounded-lg overflow-hidden border border-white/10 max-h-32">
                                <img src={vehicleImage} alt="Evidence" className="w-full h-32 object-cover" />
                            </div>
                        )}
                    </div>

                    {/* GPS (auto-captured, hidden) */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[10px] text-[#52525b]">
                        <MapPin className="w-3 h-3 text-orange-400/60" />
                        GPS: {gpsPos ? `${gpsPos.lat.toFixed(4)}, ${gpsPos.lng.toFixed(4)}` : "Acquiring..."}
                        <div className={`w-1.5 h-1.5 rounded-full ml-auto ${gpsPos ? "bg-emerald-400" : "bg-yellow-400 animate-pulse"}`} />
                    </div>

                    {/* Submit */}
                    <button
                        onClick={async () => {
                            if ((!vehicleNumber.trim() && !activityDesc.trim()) || !gpsPos) return
                            setVehicleSubmitting(true)
                            try {
                                const res = await fetch(`${API_BASE}/api/vehicle-report`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        vehicle_number: vehicleNumber.trim() || undefined,
                                        description: activityDesc.trim() || undefined,
                                        image_url: vehicleImage || null,
                                        lat: gpsPos.lat,
                                        lng: gpsPos.lng,
                                    }),
                                })
                                if (res.ok) {
                                    setVehicleSuccess(true)
                                    setVehicleNumber("")
                                    setActivityDesc("")
                                    setVehicleImage(null)
                                    setVehicleImageName("")
                                    setTimeout(() => setVehicleSuccess(false), 4000)
                                }
                            } catch { /* silent */ }
                            finally { setVehicleSubmitting(false) }
                        }}
                        disabled={vehicleSubmitting || (!vehicleNumber.trim() && !activityDesc.trim()) || !gpsPos}
                        className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all
                            bg-orange-500/15 border border-orange-500/30 text-orange-400 hover:bg-orange-500/25 hover:border-orange-500/50
                            disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {vehicleSubmitting ? (
                            <span className="flex items-center justify-center gap-2"><Loader className="w-3.5 h-3.5 animate-spin" /> Submitting...</span>
                        ) : (
                            <span className="flex items-center justify-center gap-2"><Send className="w-3.5 h-3.5" /> Submit Activity Report</span>
                        )}
                    </button>

                    {/* Success toast */}
                    <AnimatePresence>
                        {vehicleSuccess && (
                            <motion.div
                                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Activity Report Submitted. Tracking Initiated.
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>            </div>
        </TacticalLayout>
    )
}
