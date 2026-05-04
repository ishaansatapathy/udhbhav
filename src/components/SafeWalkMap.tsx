/**
 * SafeWalkMap — Leaflet mini-map for Safe Walk monitoring.
 *
 * Shows:
 *  • Pulsing user marker (CSS animation rings)
 *  • Blue polyline trace of path walked
 *  • Dark tile layer (same as LiveResponseSimulation)
 *  • Recenters smoothly on each location update
 */

import { useRef, useEffect } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { LatLng } from "../lib/useSafeWalkState"

interface Props {
    currentLocation: LatLng
    path: LatLng[]
    status: "IDLE" | "ACTIVE" | "ALERT"
}

// ── CSS for pulsing user dot ───────────────────────────────────────────────────

const PULSE_CSS = `
.sw-user-marker {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
}
.sw-user-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #3b82f6;
    border: 2px solid #fff;
    box-shadow: 0 0 8px rgba(59,130,246,0.8);
    position: relative;
    z-index: 2;
}
.sw-user-ring1 {
    position: absolute;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid rgba(59,130,246,0.5);
    animation: sw-pulse 1.8s ease-out infinite;
}
.sw-user-ring2 {
    position: absolute;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    border: 1px solid rgba(59,130,246,0.25);
    animation: sw-pulse 1.8s ease-out infinite 0.6s;
}
@keyframes sw-pulse {
    0%   { transform: scale(0.6); opacity: 0.8; }
    100% { transform: scale(1.4); opacity: 0; }
}
.sw-alert .sw-user-dot   { background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.8); }
.sw-alert .sw-user-ring1 { border-color: rgba(239,68,68,0.5); }
.sw-alert .sw-user-ring2 { border-color: rgba(239,68,68,0.25); }
`

function injectStyle() {
    if (document.getElementById("sw-map-style")) return
    const style = document.createElement("style")
    style.id = "sw-map-style"
    style.textContent = PULSE_CSS
    document.head.appendChild(style)
}

function makeUserIcon(isAlert: boolean) {
    return L.divIcon({
        className: "",
        html: `<div class="sw-user-marker ${isAlert ? "sw-alert" : ""}">
                   <div class="sw-user-ring2"></div>
                   <div class="sw-user-ring1"></div>
                   <div class="sw-user-dot"></div>
               </div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
    })
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SafeWalkMap({ currentLocation, path, status }: Props) {
    const containerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<L.Map | null>(null)
    const markerRef = useRef<L.Marker | null>(null)
    const polylineRef = useRef<L.Polyline | null>(null)

    // Initialise map once
    useEffect(() => {
        if (!containerRef.current || mapRef.current) return
        injectStyle()

        const map = L.map(containerRef.current, {
            center: [currentLocation.lat, currentLocation.lng],
            zoom: 16,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
        })

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
            maxZoom: 19,
        }).addTo(map)

        // User marker
        const marker = L.marker([currentLocation.lat, currentLocation.lng], {
            icon: makeUserIcon(status === "ALERT"),
        }).addTo(map)

        // Polyline
        const polyline = L.polyline(path.map(p => [p.lat, p.lng] as [number, number]), {
            color: "#3b82f6",
            weight: 3,
            opacity: 0.7,
            dashArray: "6 4",
        }).addTo(map)

        mapRef.current = map
        markerRef.current = marker
        polylineRef.current = polyline

        return () => {
            map.remove()
            mapRef.current = null
            markerRef.current = null
            polylineRef.current = null
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Update marker position + map center on location change
    useEffect(() => {
        if (!mapRef.current || !markerRef.current) return
        const latlng: [number, number] = [currentLocation.lat, currentLocation.lng]
        markerRef.current.setLatLng(latlng)
        markerRef.current.setIcon(makeUserIcon(status === "ALERT"))
        mapRef.current.panTo(latlng, { animate: true, duration: 0.8 })
    }, [currentLocation, status])

    // Update polyline on path change
    useEffect(() => {
        if (!polylineRef.current) return
        polylineRef.current.setLatLngs(path.map(p => [p.lat, p.lng] as [number, number]))
        // Alert → red line
        if (status === "ALERT") {
            polylineRef.current.setStyle({ color: "#ef4444" })
        } else {
            polylineRef.current.setStyle({ color: "#3b82f6" })
        }
    }, [path, status])

    return (
        <div
            ref={containerRef}
            className="w-full rounded-xl overflow-hidden"
            style={{ height: 220, border: "1px solid rgba(255,255,255,0.08)" }}
        />
    )
}
