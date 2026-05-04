// ── Fleet vehicle types ────────────────────────────────────────────────────

export interface Coord {
    lat: number
    lng: number
}

export type FleetVehicleStatus = "ACTIVE" | "ALERT" | "IDLE"

export interface FleetVehicle {
    id: string
    label: string
    status: FleetVehicleStatus
    position: Coord
    routeCoordinates: Coord[]
    routeIndex: number
    riskScore: number
    activeNodeId: string | null
}

/** Monitoring node that tracks vehicle proximity */
export interface MonitorNode {
    id: string
    lat: number
    lng: number
    radius: number              // km
    connectedVehicles: string[] // vehicle IDs currently in range
    hasAlert: boolean           // true if any connected vehicle is in ALERT
}

/** Marker color based on vehicle status */
export function getStatusColor(status: FleetVehicleStatus): string {
    switch (status) {
        case "ACTIVE": return "#3b82f6"
        case "ALERT": return "#ef4444"
        case "IDLE": return "#6b7280"
    }
}

/** Status label */
export function getStatusLabel(status: FleetVehicleStatus): string {
    switch (status) {
        case "ACTIVE": return "Active"
        case "ALERT": return "Alert"
        case "IDLE": return "Idle"
    }
}

/** Haversine distance in km between two coordinates */
export function haversineKm(a: Coord, b: Coord): number {
    const R = 6371
    const dLat = (b.lat - a.lat) * Math.PI / 180
    const dLng = (b.lng - a.lng) * Math.PI / 180
    const sinLat = Math.sin(dLat / 2)
    const sinLng = Math.sin(dLng / 2)
    const h = sinLat * sinLat +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
        sinLng * sinLng
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
