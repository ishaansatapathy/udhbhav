/**
 * Responder Service — in-memory community responder management
 * Handles proximity filtering via Haversine and responder state.
 */

// ── Haversine distance (km) ─────────────────────────────────────────────────

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Pre-populated dummy responders (Bengaluru area) ─────────────────────────

const responders = [
    { id: "RESP-001", name: "Arjun Kumar", lat: 12.9750, lng: 77.5900, available: true },
    { id: "RESP-002", name: "Priya Sharma", lat: 12.9680, lng: 77.6010, available: true },
    { id: "RESP-003", name: "Vikram Reddy", lat: 12.9820, lng: 77.5850, available: true },
    { id: "RESP-004", name: "Sneha Patel", lat: 12.9600, lng: 77.5750, available: true },
    { id: "RESP-005", name: "Ravi Gowda", lat: 12.9550, lng: 77.6100, available: true },
    { id: "RESP-006", name: "Meera Nair", lat: 12.9900, lng: 77.5700, available: true },
    { id: "RESP-007", name: "Karthik Iyer", lat: 12.9450, lng: 77.5950, available: true },
    { id: "RESP-008", name: "Divya Rao", lat: 12.9780, lng: 77.6200, available: true },
]

/** Default proximity radius in km */
const DEFAULT_RADIUS_KM = 5

/**
 * Find available responders within radius of a location.
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusKm]
 * @returns {Array<Object>} Nearby available responders with distance
 */
function findNearbyResponders(lat, lng, radiusKm = DEFAULT_RADIUS_KM) {
    return responders
        .filter(r => r.available)
        .map(r => ({
            ...r,
            distance_km: Math.round(haversineKm(lat, lng, r.lat, r.lng) * 100) / 100,
        }))
        .filter(r => r.distance_km <= radiusKm)
        .sort((a, b) => a.distance_km - b.distance_km)
}

/**
 * Mark a responder as unavailable (assigned to an emergency).
 * @param {string} responderId
 * @returns {Object|null} The responder or null if not found
 */
function markResponderBusy(responderId) {
    const r = responders.find(r => r.id === responderId)
    if (!r) return null
    r.available = false
    console.log(`[COMMUNITY] Responder ${responderId} (${r.name}) marked BUSY`)
    return { ...r }
}

/**
 * Release a responder back to available.
 * @param {string} responderId
 */
function releaseResponder(responderId) {
    const r = responders.find(r => r.id === responderId)
    if (r) {
        r.available = true
        console.log(`[COMMUNITY] Responder ${responderId} (${r.name}) released`)
    }
}

/**
 * Get all responders.
 * @returns {Array<Object>}
 */
function getAllResponders() {
    return [...responders]
}

module.exports = {
    findNearbyResponders,
    markResponderBusy,
    releaseResponder,
    getAllResponders,
}
