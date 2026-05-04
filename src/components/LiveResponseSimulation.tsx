/**
 * LiveResponseSimulation — real-time responder approach visualization.
 *
 * Shows a dark mini-map with:
 *  • User marker (red pulse, enhanced CSS animation)
 *  • Responder marker (blue → green on arrival)
 *  • Animated movement every 1.5s toward user along OSRM route
 *  • Shrinking polyline as responder advances
 *  • Distance + ETA display in header
 *  • "Responder Arrived" final state
 *  • onPositionUpdate callback to sync external SOS state machine
 *
 * Purely frontend simulation — no backend socket/API calls.
 */

import { useRef, useEffect, useState, useCallback } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { motion, AnimatePresence } from "framer-motion"
import { Navigation, Clock, MapPin, CheckCircle2 } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
    userLat: number
    userLng: number
    active: boolean          // start simulation when true
    responderName?: string
    responderLat?: number    // optional: use predetermined spawn point
    responderLng?: number
    /** Called on each animation tick with current position + arrived flag */
    onPositionUpdate?: (lat: number, lng: number, arrived: boolean) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371000 // meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Random offset ~1.2 km in a compass direction */
function randomOffset() {
    const angle = Math.random() * Math.PI * 2
    const dist = 0.010 + Math.random() * 0.002 // ~1.1–1.3 km in degrees
    return { dLat: Math.cos(angle) * dist, dLng: Math.sin(angle) * dist }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LiveResponseSimulation({
    userLat,
    userLng,
    active,
    responderName = "Arjun Kumar",
    responderLat,
    responderLng,
    onPositionUpdate,
}: Props) {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const userMarkerRef = useRef<L.CircleMarker | null>(null)
    const userPulseRef = useRef<L.CircleMarker | null>(null)
    const userPulse2Ref = useRef<L.CircleMarker | null>(null)
    const responderMarkerRef = useRef<L.Marker | null>(null)
    const pathLineRef = useRef<L.Polyline | null>(null)
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const simIdRef = useRef(0)  // guard against stale async calls

    const [responderPos, setResponderPos] = useState<{ lat: number; lng: number } | null>(null)
    const [distanceM, setDistanceM] = useState(0)
    const [etaSec, setEtaSec] = useState(0)
    const [arrived, setArrived] = useState(false)

    // ── Init map ──────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return

        const map = L.map(mapContainerRef.current, {
            center: [userLat, userLng],
            zoom: 15,
            zoomControl: false,
            attributionControl: false,
            dragging: true,
            scrollWheelZoom: false,
        })

        // Dark-tinted OSM tiles via filter
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
        }).addTo(map)

        // Apply dark filter to tiles
        const tilePane = map.getPane("tilePane")
        if (tilePane) {
            tilePane.style.filter = "brightness(0.35) saturate(0.6) contrast(1.2) hue-rotate(180deg)"
        }

        mapRef.current = map

        // User pulse ring 1 (slow outer)
        userPulse2Ref.current = L.circleMarker([userLat, userLng], {
            radius: 26,
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 0.06,
            weight: 1,
            className: "user-pulse-ring-slow",
        }).addTo(map)

        // User pulse ring 2 (fast inner)
        userPulseRef.current = L.circleMarker([userLat, userLng], {
            radius: 18,
            color: "#ef4444",
            fillColor: "#ef4444",
            fillOpacity: 0.15,
            weight: 1,
            className: "user-pulse-ring",
        }).addTo(map)

        // User dot
        userMarkerRef.current = L.circleMarker([userLat, userLng], {
            radius: 7,
            color: "#fff",
            fillColor: "#ef4444",
            fillOpacity: 1,
            weight: 2,
        }).addTo(map).bindTooltip("You", { permanent: true, direction: "top", offset: [0, -10], className: "response-tooltip" })

        return () => {
            map.remove()
            mapRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── Start simulation when active ─────────────────────────────────────────

    const startSim = useCallback(async () => {
        if (!mapRef.current) return

        // Bump sim ID so any in-flight async from a previous call is discarded
        const thisSimId = ++simIdRef.current

        // Clear previous
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
        if (responderMarkerRef.current) { mapRef.current.removeLayer(responderMarkerRef.current); responderMarkerRef.current = null }
        if (pathLineRef.current) { mapRef.current.removeLayer(pathLineRef.current); pathLineRef.current = null }

        setArrived(false)

        // Spawn responder — use provided coords or random
        const rLat = responderLat !== undefined ? responderLat : userLat + randomOffset().dLat
        const rLng = responderLng !== undefined ? responderLng : userLng + randomOffset().dLng
        setResponderPos({ lat: rLat, lng: rLng })

        // Fetch OSRM walking route (responder → user)
        let routeCoords: [number, number][] = []
        try {
            const url = `https://router.project-osrm.org/route/v1/foot/${rLng},${rLat};${userLng},${userLat}?overview=full&geometries=geojson`
            const resp = await fetch(url)
            const data = await resp.json()
            if (data.code === "Ok" && data.routes?.[0]?.geometry?.coordinates) {
                // OSRM returns [lng, lat], convert to [lat, lng]
                routeCoords = data.routes[0].geometry.coordinates.map(
                    (c: [number, number]) => [c[1], c[0]] as [number, number]
                )
            }
        } catch {
            // Fallback: straight line
        }

        // If a newer sim started while we were fetching, abort
        if (simIdRef.current !== thisSimId || !mapRef.current) return

        // If OSRM failed, create a straight-line fallback with intermediate points
        if (routeCoords.length < 2) {
            const steps = 20
            for (let i = 0; i <= steps; i++) {
                const t = i / steps
                routeCoords.push([
                    rLat + (userLat - rLat) * t,
                    rLng + (userLng - rLng) * t,
                ])
            }
        }

        // Thin route to ~40 waypoints max for smooth animation
        const maxPts = 40
        let animCoords = routeCoords
        if (routeCoords.length > maxPts) {
            const step = Math.floor(routeCoords.length / maxPts)
            animCoords = routeCoords.filter((_, i) => i % step === 0)
            // Ensure last point is user position
            animCoords.push(routeCoords[routeCoords.length - 1])
        }

        const totalDist = haversineM(rLat, rLng, userLat, userLng)
        setDistanceM(Math.round(totalDist))
        setEtaSec(Math.round(totalDist / 4.5))

        // Responder icon (blue, moving)
        const makeResponderIcon = (emoji: string, color1: string, color2: string, glow: string) =>
            L.divIcon({
                html: `<div style="
          width:28px; height:28px; border-radius:50%;
          background:radial-gradient(circle at 40% 40%, ${color1}, ${color2});
          border:2px solid #fff; display:flex; align-items:center; justify-content:center;
          box-shadow: 0 0 12px ${glow};
          font-size:14px; color:#fff;
        ">${emoji}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                className: "",
            })

        responderMarkerRef.current = L.marker([rLat, rLng], {
            icon: makeResponderIcon("🚶", "#3b82f6", "#1d4ed8", "rgba(59,130,246,0.5)"),
        })
            .addTo(mapRef.current)
            .bindTooltip(responderName, { permanent: true, direction: "top", offset: [0, -16], className: "response-tooltip" })

        // Draw full route polyline
        pathLineRef.current = L.polyline(routeCoords, {
            color: "#3b82f6",
            weight: 3,
            opacity: 0.6,
            dashArray: "8 5",
        }).addTo(mapRef.current)

        // Fit bounds to route
        mapRef.current.fitBounds(L.latLngBounds(routeCoords.map(c => L.latLng(c[0], c[1]))), { padding: [40, 40], maxZoom: 15 })

        // ── Animate along waypoints ────────────────────────────────────────────
        const state = { idx: 0 }
        tickRef.current = setInterval(() => {
            state.idx++

            if (state.idx >= animCoords.length) {
                // Arrived
                if (tickRef.current) clearInterval(tickRef.current)
                setArrived(true)
                setDistanceM(0)
                setEtaSec(0)
                setResponderPos({ lat: userLat, lng: userLng })

                // Notify parent
                onPositionUpdate?.(userLat, userLng, true)

                // Change icon to green arrived
                if (responderMarkerRef.current && mapRef.current) {
                    mapRef.current.removeLayer(responderMarkerRef.current)
                    responderMarkerRef.current = L.marker([userLat, userLng], {
                        icon: makeResponderIcon("✓", "#22c55e", "#15803d", "rgba(34,197,94,0.6)"),
                    })
                        .addTo(mapRef.current)
                        .bindTooltip(`${responderName} — Arrived`, { permanent: true, direction: "top", offset: [0, -16], className: "response-tooltip" })
                }
                // Remove route line on arrival
                if (pathLineRef.current && mapRef.current) {
                    mapRef.current.removeLayer(pathLineRef.current)
                }
                return
            }

            const [lat, lng] = animCoords[state.idx]

            // Move marker smoothly
            if (responderMarkerRef.current) {
                responderMarkerRef.current.setLatLng([lat, lng])
            }

            // Shrink route line to remaining path
            if (pathLineRef.current) {
                const remaining = animCoords.slice(state.idx)
                pathLineRef.current.setLatLngs(remaining)
            }

            // Update distance from current pos to user
            const remDist = haversineM(lat, lng, userLat, userLng)
            const remEta = Math.round(remDist / 4.5)
            setDistanceM(Math.round(remDist))
            setEtaSec(remEta)
            setResponderPos({ lat, lng })

            // Notify parent SOS state machine
            onPositionUpdate?.(lat, lng, false)
        }, 1500)
    }, [userLat, userLng, responderName, responderLat, responderLng, onPositionUpdate])

    useEffect(() => {
        if (active) startSim()
        return () => {
            // Bump simId to cancel any in-flight async
            simIdRef.current++
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
            // Clean up markers on unmount
            if (responderMarkerRef.current && mapRef.current) {
                mapRef.current.removeLayer(responderMarkerRef.current)
                responderMarkerRef.current = null
            }
            if (pathLineRef.current && mapRef.current) {
                mapRef.current.removeLayer(pathLineRef.current)
                pathLineRef.current = null
            }
        }
    }, [active, startSim])

    // ── Pulse animation (CSS-driven) ──────────────────────────────────────────

    useEffect(() => {
        // Attach animation to pulse rings once they exist
        const applyPulse = (el: HTMLElement | null, anim: string) => {
            if (el) el.style.animation = anim
        }
        if (userPulseRef.current) {
            applyPulse(userPulseRef.current.getElement() as HTMLElement | null, "pulseRing 1.6s ease-out infinite")
        }
        if (userPulse2Ref.current) {
            applyPulse(userPulse2Ref.current.getElement() as HTMLElement | null, "pulseRing 2.4s ease-out infinite 0.4s")
        }
    }, [active])

    // Format ETA
    const etaMin = Math.floor(etaSec / 60)
    const etaSecRem = etaSec % 60
    const etaDisplay = `${etaMin}m ${String(etaSecRem).padStart(2, "0")}s`
    const distDisplay = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(2)} km` : `${distanceM} m`

    return (
        <div className="rounded-xl bg-[#18181b] border border-white/8 overflow-hidden">
            {/* Inject pulse animation + tooltip style */}
            <style>{`
        @keyframes pulseRing {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.7); opacity: 0; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .user-pulse-ring       { animation: pulseRing 1.6s ease-out infinite; }
        .user-pulse-ring-slow  { animation: pulseRing 2.4s ease-out infinite 0.4s; }
        .response-tooltip {
          background: rgba(24,24,27,0.9) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #fff !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          padding: 2px 8px !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
        }
        .response-tooltip::before { display: none !important; }
      `}</style>

            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold text-white">Live Response Tracking</span>
                </div>
                <AnimatePresence mode="wait">
                    {arrived ? (
                        <motion.div
                            key="arrived"
                            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold"
                        >
                            <CheckCircle2 className="w-3 h-3" />
                            Community Assistance On-Site
                        </motion.div>
                    ) : responderPos ? (
                        <motion.div
                            key="tracking"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex items-center gap-3 text-[11px] font-mono"
                        >
                            <span className="flex items-center gap-1 text-blue-300">
                                <MapPin className="w-3 h-3" />
                                {distDisplay}
                            </span>
                            <span className="flex items-center gap-1 text-amber-300">
                                <Clock className="w-3 h-3" />
                                ETA {etaDisplay}
                            </span>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            {/* Mini Map */}
            <div
                ref={mapContainerRef}
                className="w-full border-t border-white/5"
                style={{ height: 280 }}
            />

            {/* Arrived banner */}
            <AnimatePresence>
                {arrived && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 py-3 flex items-center justify-center gap-2 bg-emerald-500/5 border-t border-emerald-500/10 text-emerald-400 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Responder Arrived — {responderName} is on-site
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
