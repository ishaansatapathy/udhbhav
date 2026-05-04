import { useState, useEffect, useRef, useCallback } from "react"
import L from "leaflet"
import * as turf from "@turf/turf"
import type { Feature, Polygon } from "geojson"
import type { Coord, FleetVehicle, MonitorNode } from "./FleetTypes"
import { getStatusColor, haversineKm } from "./FleetTypes"

// ── Constants ──────────────────────────────────────────────────────────────

const TICK_MS = 1800
const CORRIDOR_RADIUS_KM = 0.3
const RISK_INCREASE = 6
const RISK_DECAY = 3
const NODE_RADIUS_KM = 1.2        // monitoring radius per node
const NODES_PER_ROUTE = 3         // how many nodes to place per vehicle route

// ── Preset offsets ─────────────────────────────────────────────────────────

const VEHICLE_PRESETS = [
    { id: "V-01", label: "Fleet Alpha", offsetLat: 0.015, offsetLng: 0.020 },
    { id: "V-02", label: "Fleet Beta", offsetLat: -0.012, offsetLng: -0.018 },
    { id: "V-03", label: "Fleet Gamma", offsetLat: 0.008, offsetLng: 0.025 },
    { id: "V-04", label: "Fleet Delta", offsetLat: -0.020, offsetLng: 0.010 },
    { id: "V-05", label: "Fleet Echo", offsetLat: 0.022, offsetLng: -0.012 },
    { id: "V-06", label: "Fleet Foxtrot", offsetLat: -0.010, offsetLng: 0.028 },
]

// ── OSRM fetch ─────────────────────────────────────────────────────────────

async function fetchFleetRoute(start: Coord, end: Coord, signal?: AbortSignal): Promise<Coord[]> {
    const coordStr = `${start.lng},${start.lat};${end.lng},${end.lat}`
    const urls = [
        `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
        `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
    ]
    for (const url of urls) {
        try {
            const res = await fetch(url, { signal })
            if (!res.ok) continue
            const data = await res.json()
            if (data.code !== "Ok" || !data.routes?.[0]) continue
            return (data.routes[0].geometry.coordinates as [number, number][])
                .map(([lng, lat]) => ({ lat, lng }))
        } catch { continue }
    }
    return []
}

function generateFallbackRoute(start: Coord, end: Coord): Coord[] {
    const steps = 40 + Math.floor(Math.random() * 20)
    const route: Coord[] = []
    for (let i = 0; i <= steps; i++) {
        const t = i / steps
        route.push({
            lat: start.lat + (end.lat - start.lat) * t + (Math.random() - 0.5) * 0.001,
            lng: start.lng + (end.lng - start.lng) * t + (Math.random() - 0.5) * 0.001,
        })
    }
    return route
}

function buildRouteCorridor(coords: Coord[]): Feature<Polygon> | null {
    if (coords.length < 2) return null
    const line = turf.lineString(coords.map(c => [c.lng, c.lat]))
    return turf.buffer(line, CORRIDOR_RADIUS_KM, { units: "kilometers" }) as Feature<Polygon>
}

// ── Generate monitoring nodes from all vehicle routes ──────────────────────

function generateMonitorNodes(vehicles: FleetVehicle[]): MonitorNode[] {
    const nodes: MonitorNode[] = []
    const usedKeys = new Set<string>()

    vehicles.forEach(v => {
        if (v.routeCoordinates.length < 2) return
        const len = v.routeCoordinates.length
        for (let n = 0; n < NODES_PER_ROUTE; n++) {
            // Sample points evenly along each route
            const idx = Math.floor((n + 0.5) * len / NODES_PER_ROUTE)
            const pt = v.routeCoordinates[Math.min(idx, len - 1)]
            // Avoid duplicate nodes close together
            const key = `${pt.lat.toFixed(3)},${pt.lng.toFixed(3)}`
            if (usedKeys.has(key)) continue
            usedKeys.add(key)

            nodes.push({
                id: `N-${nodes.length + 1}`,
                lat: pt.lat,
                lng: pt.lng,
                radius: NODE_RADIUS_KM,
                connectedVehicles: [],
                hasAlert: false,
            })
        }
    })
    return nodes
}

// ── Proximity check: all vehicles × all nodes ──────────────────────────────

function computeProximity(
    vehicles: FleetVehicle[],
    nodes: MonitorNode[]
): { updatedVehicles: FleetVehicle[]; updatedNodes: MonitorNode[] } {
    // Reset nodes
    const resetNodes = nodes.map(n => ({
        ...n,
        connectedVehicles: [] as string[],
        hasAlert: false,
    }))

    // Check every vehicle against every node
    const updatedVehicles = vehicles.map(v => {
        if (v.status === "IDLE") return { ...v, activeNodeId: null }

        let closestNodeId: string | null = null
        let closestDist = Infinity

        for (const node of resetNodes) {
            const dist = haversineKm(v.position, { lat: node.lat, lng: node.lng })
            if (dist <= node.radius) {
                node.connectedVehicles.push(v.id)
                if (v.status === "ALERT") node.hasAlert = true
                if (dist < closestDist) {
                    closestDist = dist
                    closestNodeId = node.id
                }
            }
        }

        return { ...v, activeNodeId: closestNodeId }
    })

    return { updatedVehicles, updatedNodes: resetNodes }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useFleetSimulation(
    mapRef: React.RefObject<L.Map | null>,
    userPosition: Coord | null,
    enabled: boolean
) {
    const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
    const [nodes, setNodes] = useState<MonitorNode[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)

    // Refs
    const vehiclesRef = useRef<FleetVehicle[]>([])
    const nodesRef = useRef<MonitorNode[]>([])
    const corridorsRef = useRef<Map<string, Feature<Polygon>>>(new Map())
    const markersRef = useRef<Map<string, L.CircleMarker>>(new Map())
    const polylinesRef = useRef<Map<string, L.Polyline>>(new Map())
    const nodeMarkersRef = useRef<Map<string, L.CircleMarker>>(new Map())
    const nodeRadiiRef = useRef<Map<string, L.Circle>>(new Map())
    const nodeLinesRef = useRef<Map<string, L.Polyline>>(new Map())
    const pulseIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
    const nodePulseRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const initializedRef = useRef(false)
    const selectedIdRef = useRef<string | null>(null)

    // ── Initialize fleet + nodes ──────────────────────────────────────────────

    useEffect(() => {
        if (!enabled || !userPosition || initializedRef.current) return

        const controller = new AbortController()
        initializedRef.current = true

        const initFleet = async () => {
            const fleet: FleetVehicle[] = []

            for (const preset of VEHICLE_PRESETS) {
                const start: Coord = {
                    lat: userPosition.lat + preset.offsetLat,
                    lng: userPosition.lng + preset.offsetLng,
                }
                const dest: Coord = {
                    lat: userPosition.lat - preset.offsetLat * 1.5 + (Math.random() - 0.5) * 0.01,
                    lng: userPosition.lng - preset.offsetLng * 1.5 + (Math.random() - 0.5) * 0.01,
                }

                let routeCoords = await fetchFleetRoute(start, dest, controller.signal)
                if (routeCoords.length < 2) routeCoords = generateFallbackRoute(start, dest)

                const corridor = buildRouteCorridor(routeCoords)
                if (corridor) corridorsRef.current.set(preset.id, corridor)

                fleet.push({
                    id: preset.id,
                    label: preset.label,
                    status: "ACTIVE",
                    position: start,
                    routeCoordinates: routeCoords,
                    routeIndex: 0,
                    riskScore: 0,
                    activeNodeId: null,
                })
            }

            // Generate monitoring nodes from all routes
            const monitorNodes = generateMonitorNodes(fleet)
            nodesRef.current = monitorNodes
            setNodes([...monitorNodes])

            vehiclesRef.current = fleet
            setVehicles([...fleet])
        }

        initFleet()
        return () => controller.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, userPosition?.lat, userPosition?.lng])

    // ── Simulation tick: movement + node proximity ────────────────────────────

    useEffect(() => {
        if (!enabled || vehiclesRef.current.length === 0) return

        tickRef.current = setInterval(() => {
            // 1. Move vehicles
            const moved = vehiclesRef.current.map(v => {
                if (v.status === "IDLE") return v
                if (v.routeIndex >= v.routeCoordinates.length) {
                    return { ...v, status: "IDLE" as const }
                }

                const nextPos = v.routeCoordinates[v.routeIndex]
                const corridor = corridorsRef.current.get(v.id)

                let newStatus = v.status
                let newRisk = v.riskScore

                if (corridor) {
                    const inside = turf.booleanPointInPolygon(
                        turf.point([nextPos.lng, nextPos.lat]), corridor
                    )
                    if (!inside) {
                        newStatus = "ALERT"
                        newRisk = Math.min(100, newRisk + RISK_INCREASE)
                    } else if (v.status === "ACTIVE") {
                        newRisk = Math.max(0, newRisk - RISK_DECAY)
                    }
                }

                return { ...v, position: nextPos, routeIndex: v.routeIndex + 1, status: newStatus, riskScore: newRisk }
            })

            // 2. Proximity check: ALL vehicles × ALL nodes
            const { updatedVehicles, updatedNodes } = computeProximity(moved, nodesRef.current)

            vehiclesRef.current = updatedVehicles
            nodesRef.current = updatedNodes
            setVehicles([...updatedVehicles])
            setNodes([...updatedNodes])

            // 3. Auto-follow selected vehicle
            const focusId = selectedIdRef.current
            if (focusId && mapRef.current) {
                const tracked = updatedVehicles.find(v => v.id === focusId)
                if (tracked && tracked.status !== "IDLE") {
                    mapRef.current.panTo([tracked.position.lat, tracked.position.lng], { animate: true, duration: 0.8 })
                }
            }
        }, TICK_MS)

        return () => {
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null }
        }
    }, [enabled, vehicles.length])

    // ── Render vehicle markers + trails ────────────────────────────────────────

    useEffect(() => {
        const map = mapRef.current
        if (!map || vehicles.length === 0) return

        vehicles.forEach(v => {
            const color = getStatusColor(v.status)

            // Marker
            const existing = markersRef.current.get(v.id)
            if (existing) {
                existing.setLatLng([v.position.lat, v.position.lng])
                existing.setStyle({ fillColor: color, color: v.status === "ALERT" ? "#fca5a5" : "#fff" })
            } else {
                const marker = L.circleMarker([v.position.lat, v.position.lng], {
                    radius: 8, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.9, interactive: true,
                }).addTo(map)
                marker.bindTooltip(`${v.label} (${v.id})`, { direction: "top" })
                marker.on("click", () => {
                    setSelectedId(v.id)
                    map.flyTo([v.position.lat, v.position.lng], 15, { duration: 1 })
                })
                markersRef.current.set(v.id, marker)
            }

            // Alert pulse
            if (v.status === "ALERT" && !pulseIntervalsRef.current.has(v.id)) {
                const m = markersRef.current.get(v.id)
                if (m) {
                    let big = false
                    const interval = setInterval(() => {
                        big = !big
                        m.setStyle({ radius: big ? 12 : 8, fillOpacity: big ? 0.5 : 0.9 })
                    }, 400)
                    pulseIntervalsRef.current.set(v.id, interval)
                }
            } else if (v.status !== "ALERT" && pulseIntervalsRef.current.has(v.id)) {
                clearInterval(pulseIntervalsRef.current.get(v.id)!)
                pulseIntervalsRef.current.delete(v.id)
                markersRef.current.get(v.id)?.setStyle({ radius: 8, fillOpacity: 0.9 })
            }

            // Polyline trail
            const pl = polylinesRef.current.get(v.id)
            if (pl) {
                pl.addLatLng([v.position.lat, v.position.lng])
                pl.setStyle({ color })
            } else if (v.status !== "IDLE") {
                const newPl = L.polyline([[v.position.lat, v.position.lng]], {
                    color, weight: 3, opacity: 0.7,
                }).addTo(map)
                polylinesRef.current.set(v.id, newPl)
            }
        })
    }, [vehicles, mapRef])

    // ── Render node markers + connection lines ─────────────────────────────────

    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        nodes.forEach(node => {
            const isActive = node.connectedVehicles.length > 0
            const isAlert = node.hasAlert

            const fillColor = isAlert ? "#ef4444" : isActive ? "#22c55e" : "#3f3f46"
            const borderColor = isAlert ? "#fca5a5" : isActive ? "#86efac" : "#52525b"
            const fillOpacity = isActive ? 0.9 : 0.4

            // Node marker
            const existing = nodeMarkersRef.current.get(node.id)
            if (existing) {
                existing.setStyle({
                    fillColor, color: borderColor, fillOpacity,
                    radius: isActive ? 9 : 6,
                    weight: isActive ? 2.5 : 1.5,
                    opacity: isActive ? 1 : 0.5,
                })
            } else {
                const m = L.circleMarker([node.lat, node.lng], {
                    radius: 6, fillColor, color: borderColor,
                    weight: 1.5, fillOpacity: 0.4, opacity: 0.5, interactive: true,
                }).addTo(map)
                m.bindTooltip(`Node ${node.id}`, { direction: "top", className: "police-tooltip" })
                nodeMarkersRef.current.set(node.id, m)
            }

            // Radius circle
            const existingRadius = nodeRadiiRef.current.get(node.id)
            if (existingRadius) {
                existingRadius.setStyle({
                    color: isAlert ? "#ef4444" : isActive ? "#22c55e" : "#3f3f46",
                    fillColor: isAlert ? "#ef4444" : isActive ? "#22c55e" : "#3f3f46",
                    fillOpacity: isActive ? 0.04 : 0.01,
                    opacity: isActive ? 0.3 : 0.1,
                })
            } else {
                const circle = L.circle([node.lat, node.lng], {
                    radius: node.radius * 1000,
                    color: "#3f3f46", fillColor: "#3f3f46",
                    fillOpacity: 0.01, opacity: 0.1, weight: 1,
                }).addTo(map)
                nodeRadiiRef.current.set(node.id, circle)
            }

            // Node pulse for alert
            if (isAlert && !nodePulseRef.current.has(node.id)) {
                const m = nodeMarkersRef.current.get(node.id)
                if (m) {
                    let big = false
                    const interval = setInterval(() => {
                        big = !big
                        m.setStyle({ radius: big ? 13 : 9, fillOpacity: big ? 0.5 : 0.9 })
                    }, 500)
                    nodePulseRef.current.set(node.id, interval)
                }
            } else if (!isAlert && nodePulseRef.current.has(node.id)) {
                clearInterval(nodePulseRef.current.get(node.id)!)
                nodePulseRef.current.delete(node.id)
            }

            // Connection lines from node to each connected vehicle
            const lineKey = node.id
            const existingLine = nodeLinesRef.current.get(lineKey)
            if (existingLine) { existingLine.remove(); nodeLinesRef.current.delete(lineKey) }

            if (node.connectedVehicles.length > 0) {
                const connVehicles = vehiclesRef.current.filter(v =>
                    node.connectedVehicles.includes(v.id)
                )
                connVehicles.forEach(v => {
                    const perVehicleKey = `${node.id}→${v.id}`
                    const oldLine = nodeLinesRef.current.get(perVehicleKey)
                    if (oldLine) oldLine.remove()

                    const lineColor = v.status === "ALERT" ? "#ef4444" : "#22c55e"
                    const line = L.polyline(
                        [[node.lat, node.lng], [v.position.lat, v.position.lng]],
                        { color: lineColor, weight: 1.5, dashArray: "4 8", opacity: 0.6 }
                    ).addTo(map)

                    // Animate dash
                    requestAnimationFrame(() => {
                        const el = (line as unknown as { _path?: SVGPathElement })._path
                        if (el) el.style.animation = "policeDash 0.85s linear infinite"
                    })

                    nodeLinesRef.current.set(perVehicleKey, line)
                })
            }
        })
    }, [nodes, mapRef])

    // ── Cleanup ────────────────────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (tickRef.current) clearInterval(tickRef.current)
            markersRef.current.forEach(m => m.remove())
            polylinesRef.current.forEach(p => p.remove())
            nodeMarkersRef.current.forEach(m => m.remove())
            nodeRadiiRef.current.forEach(c => c.remove())
            nodeLinesRef.current.forEach(l => l.remove())
            pulseIntervalsRef.current.forEach(i => clearInterval(i))
            nodePulseRef.current.forEach(i => clearInterval(i))
            markersRef.current.clear()
            polylinesRef.current.clear()
            nodeMarkersRef.current.clear()
            nodeRadiiRef.current.clear()
            nodeLinesRef.current.clear()
            pulseIntervalsRef.current.clear()
            nodePulseRef.current.clear()
            initializedRef.current = false
        }
    }, [])

    // ── Focus vehicle ──────────────────────────────────────────────────────────

    const focusVehicle = useCallback((id: string) => {
        // Toggle: click again to unfollow
        if (selectedIdRef.current === id) {
            selectedIdRef.current = null
            setSelectedId(null)
            return
        }
        selectedIdRef.current = id
        setSelectedId(id)
        const v = vehiclesRef.current.find(v => v.id === id)
        if (v && mapRef.current) {
            mapRef.current.flyTo([v.position.lat, v.position.lng], 15, { duration: 1 })
        }
    }, [mapRef])

    // ── Trigger deviation ──────────────────────────────────────────────────────

    const triggerDeviation = useCallback((id: string) => {
        const updated = vehiclesRef.current.map(v => {
            if (v.id !== id) return v
            return {
                ...v,
                position: {
                    lat: v.position.lat + 0.015 + Math.random() * 0.005,
                    lng: v.position.lng - 0.015 - Math.random() * 0.005,
                },
                status: "ALERT" as const,
                riskScore: Math.min(100, v.riskScore + 40),
            }
        })
        vehiclesRef.current = updated
        setVehicles([...updated])
    }, [])

    return { vehicles, nodes, selectedId, focusVehicle, triggerDeviation }
}
