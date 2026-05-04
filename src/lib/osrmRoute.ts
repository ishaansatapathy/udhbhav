/** Bangalore-area driving routes via public OSRM (same pattern as Cab / Police dashboards). */

export type LatLng = { lat: number; lng: number }

/** Returns [lat, lng][] for Leaflet (minimum two points — straight fallback on failure). */
export async function fetchDrivingRouteLatLng(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<[number, number][]> {
  const coordStr = `${from.lng},${from.lat};${to.lng},${to.lat}`
  const urls = [
    `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
    `https://routing.openstreetmap.de/routed-car/route/v1/driving/${coordStr}?overview=full&geometries=geojson`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal })
      if (!res.ok) continue
      const data = await res.json()
      if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) continue
      const coords = data.routes[0].geometry.coordinates as [number, number][]
      return coords.map(([lng, lat]) => [lat, lng])
    } catch {
      if (signal?.aborted) return [[from.lat, from.lng], [to.lat, to.lng]]
    }
  }
  return [[from.lat, from.lng], [to.lat, to.lng]]
}

/** Remaining path: current GPS → nearest forward waypoint → … → destination (keeps road shape). */
export function trimRouteFromAgent(full: [number, number][], pos: LatLng): [number, number][] {
  if (full.length < 2) return full
  let bestIdx = 0
  let bestD = Infinity
  for (let i = 0; i < full.length; i++) {
    const d = Math.hypot(full[i][0] - pos.lat, full[i][1] - pos.lng)
    if (d < bestD) {
      bestD = d
      bestIdx = i
    }
  }
  const tail = full.slice(bestIdx + 1)
  const dest = full[full.length - 1]
  if (tail.length === 0) return [[pos.lat, pos.lng], dest]
  return [[pos.lat, pos.lng], ...tail]
}
