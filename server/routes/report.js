/**
 * routes/report.js — Unified incident report endpoints.
 *
 * POST  /api/report        → Submit a new report (from any module)
 * GET   /api/report        → List all reports
 * PATCH /api/report/:id    → Update report status
 *
 * The POST endpoint emits "new_report" via Socket.io so the
 * Police Dashboard receives it in real-time.
 */

const express = require("express")
const router = express.Router()
const reportService = require("../services/reportService")

let _io = null

/**
 * Inject the shared Socket.io instance (called once from server.js).
 */
function setIo(io) {
  _io = io
}

// ── POST /api/report ──────────────────────────────────────────────────────────
router.post("/", (req, res) => {
  const { source, category, description, location, tripId, severity } = req.body

  if (!description && !category) {
    return res.status(400).json({ error: "At least category or description is required" })
  }

  const report = reportService.addReport({
    source,
    category,
    description,
    location,
    tripId,
    severity,
  })

  // Broadcast to all connected clients (Police Dashboard)
  if (_io) {
    _io.emit("new_report", report)
  }

  res.status(201).json(report)
})

// ── GET /api/report ───────────────────────────────────────────────────────────
router.get("/", (_req, res) => {
  res.json(reportService.getReports())
})

// ── PATCH /api/report/:id ─────────────────────────────────────────────────────
router.patch("/:id", (req, res) => {
  const { status } = req.body
  if (!status) return res.status(400).json({ error: "status is required" })

  const result = reportService.updateReportStatus(req.params.id, status)
  if (result.error) return res.status(404).json({ error: result.error })

  // Broadcast status update
  if (_io) {
    _io.emit("report_updated", result.report)
  }

  res.json(result.report)
})

module.exports = { router, setIo }
