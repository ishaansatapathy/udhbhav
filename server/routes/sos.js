/**
 * SOS Routes — REST endpoints for emergency management
 * POST /api/sos   — create a new SOS event
 * PATCH /api/sos/:id — update status (RESOLVED / ESCALATED)
 */

const express = require("express")
const router = express.Router()
const emergencyService = require("../services/emergencyService")
const { broadcastNewEmergency, broadcastUpdateEmergency } = require("../socket/sosSocketEvents")
const { sendEmailToContacts } = require("../services/emailService")

/**
 * Attach Socket.io instance to the router.
 * Must be called once from server.js: sosRoutes.setIo(io)
 */
let _io = null
function setIo(io) { _io = io }

// ── POST /api/sos ──────────────────────────────────────────────────────────

router.post("/", (req, res) => {
    const { user_id, lat, lng, level } = req.body

    // Validate
    if (!user_id || lat == null || lng == null || !level) {
        return res.status(400).json({ error: "Missing required fields: user_id, lat, lng, level" })
    }
    if (!["LOW", "MEDIUM", "HIGH"].includes(level)) {
        return res.status(400).json({ error: "level must be LOW, MEDIUM, or HIGH" })
    }

    const emergency = emergencyService.createEmergency({ user_id, lat, lng, level, category: req.body.category })

    // Broadcast via Socket.io
    if (_io) {
      broadcastNewEmergency(_io, emergency)
      // Also emit as POLICE_ALERT so the Police Dashboard picks it up in its alerts panel
      _io.emit("POLICE_ALERT", {
        payload: {
          tripId: emergency.event_id,
          type: "SOS",
          severity: emergency.level,
          category: emergency.category || "EMERGENCY",
          location: { lat: emergency.lat, lng: emergency.lng },
          timestamp: emergency.timestamp,
          user_id: emergency.user_id,
        },
        signature: "",
        publicKey: "",
        receivedAt: Date.now(),
        socketId: "sos-api",
      })
    }

    // Send email alerts to enabled trusted contacts (fire-and-forget)
    sendEmailToContacts(emergency)
      .then((result) => console.log(`[SOS] Email alerts: ${result.sent} sent, ${result.failed} failed`))
      .catch((err) => console.error("[SOS] Email alert error:", err.message))

    res.status(201).json({ ok: true, emergency })
})

// ── PATCH /api/sos/:id ─────────────────────────────────────────────────────

router.patch("/:id", (req, res) => {
    const { id } = req.params
    const { status } = req.body

    if (!status || !["RESOLVED", "ESCALATED"].includes(status)) {
        return res.status(400).json({ error: "status must be RESOLVED or ESCALATED" })
    }

    const updated = emergencyService.updateEmergencyStatus(id, status)
    if (!updated) {
        return res.status(404).json({ error: `Emergency ${id} not found` })
    }

    // Broadcast update via Socket.io
    if (_io) broadcastUpdateEmergency(_io, updated)

    res.json({ ok: true, emergency: updated })
})

module.exports = { router, setIo }
