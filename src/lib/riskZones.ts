/**
 * riskZones — Static risk zone definitions for the Bangalore area.
 *
 * Each zone is a polygon (array of [lat, lng] tuples) with a risk level.
 * Used by the RiskHeatmap overlay and the zone-entry detection logic.
 */

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW"

export interface RiskZone {
  id: string
  type: RiskLevel
  label: string
  coordinates: [number, number][] // [lat, lng]
}

/** Color palette for each risk level (fill + border) */
export const ZONE_COLORS: Record<RiskLevel, { fill: string; border: string }> = {
  HIGH:   { fill: "#ff0000", border: "#ff3333" },
  MEDIUM: { fill: "#ff8800", border: "#ffaa33" },
  LOW:    { fill: "#22c55e", border: "#4ade80" },
}

/**
 * Bangalore-area risk zones — coordinates chosen so they overlap the
 * existing police-station map (centered ~12.97, 77.59).
 */
export const riskZones: RiskZone[] = [
  {
    id: "zone1",
    type: "HIGH",
    label: "Majestic / KR Market",
    coordinates: [
      [12.978, 77.570],
      [12.978, 77.585],
      [12.965, 77.585],
      [12.965, 77.570],
    ],
  },
  {
    id: "zone2",
    type: "HIGH",
    label: "Shivajinagar",
    coordinates: [
      [12.990, 77.600],
      [12.990, 77.615],
      [12.978, 77.615],
      [12.978, 77.600],
    ],
  },
  {
    id: "zone3",
    type: "MEDIUM",
    label: "Yeshwanthpur Industrial",
    coordinates: [
      [13.010, 77.540],
      [13.010, 77.560],
      [12.998, 77.560],
      [12.998, 77.540],
    ],
  },
  {
    id: "zone4",
    type: "MEDIUM",
    label: "Peenya",
    coordinates: [
      [13.030, 77.510],
      [13.030, 77.535],
      [13.015, 77.535],
      [13.015, 77.510],
    ],
  },
  {
    id: "zone5",
    type: "LOW",
    label: "Koramangala",
    coordinates: [
      [12.940, 77.615],
      [12.940, 77.640],
      [12.925, 77.640],
      [12.925, 77.615],
    ],
  },
  {
    id: "zone6",
    type: "LOW",
    label: "Indiranagar",
    coordinates: [
      [12.980, 77.635],
      [12.980, 77.655],
      [12.968, 77.655],
      [12.968, 77.635],
    ],
  },
]

/**
 * Ray-casting point-in-polygon check.
 * Returns the first matching zone, or null if the point is outside all zones.
 */
export function getZoneAtPoint(lat: number, lng: number): RiskZone | null {
  for (const zone of riskZones) {
    if (isInsidePolygon(lat, lng, zone.coordinates)) return zone
  }
  return null
}

/** Simple ray-casting algorithm — no external dependencies. */
function isInsidePolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false
  const n = polygon.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i]
    const [yj, xj] = polygon[j]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}
