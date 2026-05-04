/**
 * reportService.js — In-memory Incident Reports store.
 *
 * Centralized storage for reports submitted from any module
 * (Cab ride, Personal Emergency, etc.). Reports are emitted
 * in real-time to the Police Dashboard via Socket.io.
 */

let incidentReports = []
let nextId = 1

/**
 * Add a new incident report.
 * @param {object} data — { source, category, description, location, tripId?, severity? }
 * @returns {object} The saved report object.
 */
function addReport(data) {
  const report = {
    id: `RPT-${String(nextId++).padStart(4, "0")}`,
    source: data.source || "UNKNOWN",       // "CAB" | "EMERGENCY" | "COMMUNITY"
    category: data.category || "GENERAL",
    description: data.description || "",
    location: data.location || null,         // { lat, lng }
    tripId: data.tripId || null,
    severity: data.severity || "MEDIUM",     // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    status: "UNDER_REVIEW",
    timestamp: Date.now(),
  }
  incidentReports.push(report)
  return report
}

/**
 * Return all incident reports (newest first).
 */
function getReports() {
  return [...incidentReports].reverse()
}

/**
 * Update the status of a report by id.
 * @returns {{ report?: object, error?: string }}
 */
function updateReportStatus(id, status) {
  const report = incidentReports.find(r => r.id === id)
  if (!report) return { error: "Report not found" }
  report.status = status
  return { report }
}

module.exports = {
  addReport,
  getReports,
  updateReportStatus,
}
