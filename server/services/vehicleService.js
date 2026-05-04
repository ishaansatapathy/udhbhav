/**
 * vehicleService.js — In-memory suspicious activity report store
 * with simulated GPS tracking after report creation.
 */

let vehicleReports = []
let nextSeqId = 1

/**
 * Create a new suspicious activity report and return the stored object.
 */
function createReport({ vehicle_number, description, image_url, lat, lng }) {
  const id = `SAR-${String(nextSeqId++).padStart(4, "0")}`
  const report = {
    id,
    vehicle_number: vehicle_number ? vehicle_number.toUpperCase().replace(/\s+/g, "") : null,
    description: description || null,
    image_url: image_url || null,
    lat,
    lng,
    timestamp: Date.now(),
    status: "TRACKING_INITIATED",
    tracking_history: [{ lat, lng, timestamp: Date.now() }],
  }
  vehicleReports.push(report)
  return report
}

/**
 * Return all vehicle reports (newest first).
 */
function getReports() {
  return [...vehicleReports].reverse()
}

/**
 * Update the status of a report.
 */
function updateStatus(id, status) {
  const report = vehicleReports.find((r) => r.id === id)
  if (!report) return null
  report.status = status
  return report
}

/**
 * Push a new location into a report's tracking_history.
 */
function pushTrackingPoint(id, lat, lng) {
  const report = vehicleReports.find((r) => r.id === id)
  if (!report) return null
  const point = { lat, lng, timestamp: Date.now() }
  report.tracking_history.push(point)
  report.lat = lat
  report.lng = lng
  return { id, lat, lng, timestamp: point.timestamp }
}

/**
 * Start simulated movement for a report.
 * Emits location updates every 5 seconds for 30 seconds total,
 * then marks the vehicle as VEHICLE_OUT_OF_RANGE.
 *
 * @param {object} io — Socket.io server instance
 * @param {string} id — Report id
 * @param {string[]} knownCabIds — list of registered cab/driver ids for smart linking
 */
function startSimulatedTracking(io, id, knownCabIds = []) {
  const report = vehicleReports.find((r) => r.id === id)
  if (!report) return

  // ── Smart link: check if the number matches a registered driver/cab ──
  const normalised = (report.vehicle_number || "").replace(/\s+/g, "").toUpperCase()
  const linked = knownCabIds.find(
    (cid) => cid.toUpperCase().replace(/[_\-\s]/g, "") === normalised
  )
  if (linked) {
    report.status = "LINKED_TO_REGISTERED_DRIVER"
    report.linkedDriverId = linked
    io.emit("new_vehicle_report", report)
  }

  let ticks = 0
  const maxTicks = 6 // 6 × 5 s = 30 s

  const interval = setInterval(() => {
    ticks++

    // Small random offset (≈ 50-150 m)
    const dLat = (Math.random() - 0.4) * 0.0015
    const dLng = (Math.random() - 0.4) * 0.0015
    const newLat = report.lat + dLat
    const newLng = report.lng + dLng

    const update = pushTrackingPoint(id, newLat, newLng)
    if (!update) { clearInterval(interval); return }

    if (report.status === "TRACKING_INITIATED") {
      report.status = "ACTIVE_TRACKING"
    }

    io.emit("vehicle_location_update", {
      ...update,
      status: report.status,
    })

    if (ticks >= maxTicks) {
      clearInterval(interval)
      report.status = "VEHICLE_OUT_OF_RANGE"
      io.emit("vehicle_location_update", {
        id,
        lat: report.lat,
        lng: report.lng,
        timestamp: Date.now(),
        status: "VEHICLE_OUT_OF_RANGE",
      })
    }
  }, 5000)
}

module.exports = {
  createReport,
  getReports,
  updateStatus,
  pushTrackingPoint,
  startSimulatedTracking,
}
