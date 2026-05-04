/**
 * routes/vehicleReport.js — Suspicious activity report endpoints.
 *
 * POST /api/vehicle-report   — Submit a new report
 * GET  /api/vehicle-report   — List all reports
 */

const express = require("express")
const router = express.Router()
const vehicleService = require("../services/vehicleService")

let _io = null
function setIo(io) { _io = io }

// ── POST /api/vehicle-report ──────────────────────────────────────────────────

router.post("/", (req, res) => {
  const { vehicle_number, description, image_url, lat, lng } = req.body

  if (lat == null || lng == null) {
    return res.status(400).json({ error: "Missing required fields: lat, lng" })
  }
  if (!vehicle_number && !description) {
    return res.status(400).json({ error: "Provide a vehicle number or description" })
  }

  const report = vehicleService.createReport({ vehicle_number, description, image_url, lat, lng })

  // Broadcast to all connected clients (Police Dashboard)
  if (_io) {
    _io.emit("new_vehicle_report", report)

    // Start simulated movement tracking
    vehicleService.startSimulatedTracking(_io, report.id, [])
  }

  res.status(201).json({ ok: true, report })
})

// ── GET /api/vehicle-report ───────────────────────────────────────────────────

router.get("/", (_req, res) => {
  res.json(vehicleService.getReports())
})

module.exports = { router, setIo }
