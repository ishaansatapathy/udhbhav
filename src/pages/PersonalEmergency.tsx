import { useState, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    ShieldAlert, Phone, Radio, MapPin,
    Eye, Activity, ChevronDown, Check,
    Footprints, AlertTriangle, Clock,
    Zap, Send, Users, UserCheck, Loader,
    Car, Camera, Upload, CheckCircle2, FileWarning,
} from "lucide-react"
import { useSafeWalkState } from "../lib/useSafeWalkState"
import { useSmartAlert } from "../lib/useSmartAlert"
import SafeWalkPanel from "../components/SafeWalkPanel"
import SafeWalkMap from "../components/SafeWalkMap"
import SmartAlertModal from "../components/SmartAlertModal"
import LiveResponseSimulation from "../components/LiveResponseSimulation"
import TrustedContacts from "../components/TrustedContacts"
import TacticalLayout from "../components/TacticalLayout"
import TacticalNav from "../components/TacticalNav"
import SosBanner from "../components/SosBanner"
import SosPanel from "../components/SosPanel"
import { useSosState } from "../lib/useSosState"
import {
    useEmergencyEntrance,
    useSOSPulseRings,
    animateTimelineStep,
    triggerSOSShockwave,
} from "../lib/useAnimeAnimations"

import { API_BASE } from "../lib/config"

const CATEGORIES = [
    { value: "PERSONAL_THREAT", label: "Personal Threat", icon: "🛡️" },
    { value: "MEDICAL_EMERGENCY", label: "Medical Emergency", icon: "🏥" },
    { value: "HARASSMENT", label: "Harassment", icon: "⚠️" },
    { value: "SUSPICIOUS_ACTIVITY", label: "Suspicious Activity", icon: "👁️" },
]

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

export default function PersonalEmergency() {
    const [category, setCategory] = useState(CATEGORIES[0].value)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [sending, setSending] = useState(false)
    const [confirmation, setConfirmation] = useState<string | null>(null)
    const [holdProgress, setHoldProgress] = useState(0)
    const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number } | null>(null)

    // Suspicious Activity Report state
    const [vehicleNumber, setVehicleNumber] = useState("")
    const [activityDesc, setActivityDesc] = useState("")
    const [vehicleImage, setVehicleImage] = useState<string | null>(null)
    const [vehicleImageName, setVehicleImageName] = useState("")
    const [vehicleSubmitting, setVehicleSubmitting] = useState(false)
    const [vehicleSuccess, setVehicleSuccess] = useState(false)

    // Simulation timeline state
    const [simSteps, setSimSteps] = useState<SimStep[]>([])
    const [responderAssigned, setResponderAssigned] = useState(false)
    const simTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

    const holdTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const holdStartRef = useRef<number>(0)
    const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Anime.js hooks
    const emergencyRef = useEmergencyEntrance()
    const sosPulseRef = useSOSPulseRings(!sending)
    const sosButtonRef = useRef<HTMLButtonElement>(null)
    const timelineContainerRef = useRef<HTMLDivElement>(null)

    // SOS state machine
    const userLatFallback = gpsPos?.lat ?? 12.9716
    const userLngFallback = gpsPos?.lng ?? 77.5946
    const { sosState, activateSOS, resetSOS, updateResponderPos } = useSosState(
        userLatFallback,
        userLngFallback,
    )

    // GPS — get initial position
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setGpsPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setGpsPos({ lat: 12.9716 + (Math.random() - 0.5) * 0.01, lng: 77.5946 + (Math.random() - 0.5) * 0.01 })
            )
        } else {
            setGpsPos({ lat: 12.9716, lng: 77.5946 })
        }
    }, [])

    // Safe Walk state machine
    const seedLocation = gpsPos ?? { lat: 12.9716, lng: 77.5946 }
    const { safeWalkState, path: walkPath, startWalk, stopWalk, simulateStop, resetAlert } = useSafeWalkState(seedLocation)

    // ── Smart Alert system ──────────────────────────────────────────────────
    const { alertState, triggerAlert, dismiss: dismissAlert, escalate: escalateAlert, MESSAGES: ALERT_MESSAGES } = useSmartAlert()

    // Bridge: Safe Walk ALERT → Smart Alert
    useEffect(() => {
        if (safeWalkState.status === "ALERT") {
            triggerAlert("STOP")
        }
    }, [safeWalkState.status, triggerAlert])

    // Silent trigger: hold 'V' for 3 seconds
    useEffect(() => {
        const onDown = (e: KeyboardEvent) => {
            if (e.key === "v" || e.key === "V") {
                if (holdStartRef.current) return
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

    // Start simulation timeline (visual steps only)
    const startSimulation = useCallback(() => {
        simTimersRef.current.forEach(t => clearTimeout(t))
        simTimersRef.current = []

        setResponderAssigned(false)

        const initial: SimStep[] = STEP_DEFS.map(s => ({ id: s.id, label: s.label, icon: s.icon, status: "pending" as const, detail: s.detail }))
        setSimSteps(initial)

        STEP_DEFS.forEach((def, idx) => {
            const timer = setTimeout(() => {
                setSimSteps(prev => prev.map((s, i) => {
                    if (i < idx) return { ...s, status: "done" }
                    if (i === idx) return { ...s, status: "done" }
                    if (i === idx + 1) return { ...s, status: "active" }
                    return s
                }))

                if (timelineContainerRef.current) {
                    animateTimelineStep(timelineContainerRef.current, idx)
                }

                if (def.id === "assigned") {
                    setResponderAssigned(true)
                }
            }, def.delayMs)
            simTimersRef.current.push(timer)
        })
    }, [])

    // Cleanup sim timers
    useEffect(() => {
        return () => {
            simTimersRef.current.forEach(t => clearTimeout(t))
        }
    }, [])

    const triggerEmergency = useCallback(async () => {
        if (sending) return
        setSending(true)

        if (sosButtonRef.current) {
            triggerSOSShockwave(sosButtonRef.current.parentElement as HTMLElement)
        }

        const lat = gpsPos?.lat ?? 12.9716
        const lng = gpsPos?.lng ?? 77.5946

        activateSOS()

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
                startSimulation()
            }
        } catch {
            setConfirmation("Offline mode — Running simulation")
            startSimulation()
        } finally {
            setSending(false)
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)
            confirmTimeoutRef.current = setTimeout(() => setConfirmation(null), 4000)
        }
    }, [sending, gpsPos, category, startSimulation, activateSOS])

    // Cleanup
    useEffect(() => {
        return () => {
            if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current)
        }
    }, [])

    const selectedCat = CATEGORIES.find(c => c.value === category)!

    // Format escalation countdown using ETA
    const etaSec = sosState.eta ?? 120
    const escMin = Math.floor(etaSec / 60)
    const escSec = etaSec % 60
    const escDisplay = `${String(escMin).padStart(2, "0")}:${String(escSec).padStart(2, "0")}`

    return (
        <TacticalLayout>
            <TacticalNav />

            {/* SOS Emergency Top Banner */}
            <SosBanner sosState={sosState} onCancel={resetSOS} />

            {/* Smart Alert Modal (proactive — fires before SOS) */}
            <SmartAlertModal
                alertState={alertState}
                messages={ALERT_MESSAGES}
                onSafe={() => {
                    dismissAlert()
                    if (safeWalkState.status === "ALERT") resetAlert()
                }}
                onHelp={() => {
                    escalateAlert()
                    triggerEmergency()
                }}
            />

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

                {/* Category Selector */}
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

                {/* SOS Button */}
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
                            <div className="sos-ring-inner absolute inset-0 rounded-full border-2 border-red-400" />
                            <div className="sos-ring-outer absolute -inset-3 rounded-full border border-red-500/30" />
                            <Phone className="w-10 h-10 text-white drop-shadow-lg" />
                            <span className="text-white text-sm font-black tracking-wider uppercase">
                                {sending ? "Sending..." : "Trigger Emergency"}
                            </span>
                        </motion.button>
                    </div>
                </div>

                {/* Confirmation */}
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

                {/* Live Emergency Activity Panel */}
                <AnimatePresence>
                    {sosState.active && simSteps.length > 0 && (
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

                                    let dotColor = "bg-[#3f3f46]"
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
                                            <div className="flex w-5 shrink-0 flex-col items-center">
                                                <div className={`step-dot w-2.5 h-2.5 rounded-full mt-1 ${dotColor} transition-colors`} />
                                                {i < simSteps.length - 1 && (
                                                    <div className={`step-line w-px h-7 ${isDone ? lineColor : "bg-[#27272a]"} transition-colors`} style={{ transformOrigin: "top" }} />
                                                )}
                                            </div>
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

                {/* SOS Status Panel */}
                <SosPanel sosState={sosState} />

                {/* Live Response Tracking */}
                <AnimatePresence>
                    {sosState.active && (sosState.status === "ENROUTE" || sosState.status === "ARRIVED") && gpsPos && (
                        <motion.div
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                        >
                            <LiveResponseSimulation
                                userLat={gpsPos.lat}
                                userLng={gpsPos.lng}
                                active={true}
                                responderName="Arjun Kumar"
                                responderLat={sosState.responder?.lat}
                                responderLng={sosState.responder?.lng}
                                onPositionUpdate={updateResponderPos}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Trusted Contacts */}
                <TrustedContacts />

                {/* Silent Trigger */}
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

                {/* Safe Walk Mode */}
                <div className="emer-panel tactical-card rounded-xl p-5 space-y-4" style={{ opacity: 0 }}>
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Footprints className="w-5 h-5 text-blue-400" />
                            <div>
                                <span className="text-sm font-bold text-white">Safe Walk Mode</span>
                                <p className="text-[10px] text-[#71717a] mt-0.5">Real-time personal safety monitoring</p>
                            </div>
                        </div>
                        <button
                            onClick={() => safeWalkState.active ? stopWalk() : startWalk()}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                safeWalkState.active ? "bg-blue-500" : "bg-[#3f3f46]"
                            }`}
                        >
                            <motion.div
                                animate={{ x: safeWalkState.active ? 24 : 2 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                            />
                        </button>
                    </div>

                    <AnimatePresence>
                        {safeWalkState.active && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 overflow-hidden"
                            >
                                {/* Monitoring badge */}
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/8 border border-blue-500/15">
                                    <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                                    <span className="text-xs text-blue-300 font-medium">You are being monitored</span>
                                    <span className="ml-auto text-[10px] text-blue-400/60 font-mono">
                                        {safeWalkState.currentLocation
                                            ? `${safeWalkState.currentLocation.lat.toFixed(4)}°N`
                                            : "Acquiring..."}
                                    </span>
                                </div>

                                {/* Mini-map */}
                                {safeWalkState.currentLocation && (
                                    <SafeWalkMap
                                        currentLocation={safeWalkState.currentLocation}
                                        path={walkPath}
                                        status={safeWalkState.status}
                                    />
                                )}

                                {/* Guardian panel */}
                                <SafeWalkPanel state={safeWalkState} />

                                {/* Simulate Stop */}
                                <button
                                    onClick={simulateStop}
                                    disabled={safeWalkState.status === "ALERT"}
                                    className="w-full px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider
                                        bg-amber-500/10 border border-amber-500/20 text-amber-400
                                        hover:bg-amber-500/20 transition-colors
                                        disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    🧪 Simulate Stop (triggers alert in 5s)
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Info */}
                <div className="emer-panel flex items-start gap-3 px-4 py-3 rounded-xl tactical-card text-[#52525b] text-[11px]" style={{ opacity: 0, padding: "12px 16px" }}>
                    <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                        All emergency signals are routed to the centralized SOS backend and broadcast to nearby community responders and police stations in real-time.
                    </span>
                </div>

                {/* Report Suspicious Activity */}
                <div className="emer-panel tactical-card rounded-xl p-5 space-y-4" style={{ opacity: 0 }}>
                    <div className="flex items-center gap-2">
                        <FileWarning className="w-5 h-5 text-orange-400" />
                        <span className="text-sm font-bold text-white">Report Suspicious Activity</span>
                    </div>
                    <p className="text-[10px] text-[#71717a] leading-relaxed">
                        Report any suspicious activity — vehicles, persons, or incidents. Include details, photos, and optional vehicle numbers for police intelligence tracking.
                    </p>

                    <textarea
                        placeholder="Describe the suspicious activity..."
                        value={activityDesc}
                        onChange={e => setActivityDesc(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg bg-white/4 border border-white/10 text-white text-xs
                            placeholder:text-[#52525b] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all resize-none"
                    />

                    <div className="relative">
                        <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525b]" />
                        <input
                            type="text"
                            placeholder="Vehicle number — optional (e.g. KA01AB1234)"
                            value={vehicleNumber}
                            onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/4 border border-white/10 text-white text-xs
                                placeholder:text-[#52525b] focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-all font-mono tracking-wider"
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/4 border border-white/10
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

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/3 border border-white/6 text-[10px] text-[#52525b]">
                        <MapPin className="w-3 h-3 text-orange-400/60" />
                        GPS: {gpsPos ? `${gpsPos.lat.toFixed(4)}, ${gpsPos.lng.toFixed(4)}` : "Acquiring..."}
                        <div className={`w-1.5 h-1.5 rounded-full ml-auto ${gpsPos ? "bg-emerald-400" : "bg-yellow-400 animate-pulse"}`} />
                    </div>

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
                </div>
            </div>
        </TacticalLayout>
    )
}
