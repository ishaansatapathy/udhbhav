/**
 * Responder Routes — community response endpoints
 * POST /api/respond/:emergencyId/accept — responder accepts an emergency
 */

const express = require("express")
const router = express.Router()
const emergencyService = require("../services/emergencyService")
const responderService = require("../services/responderService")
const { broadcastUpdateEmergency } = require("../socket/sosSocketEvents")

let _io = null
function setIo(io) { _io = io }

// ── POST /api/respond/:emergencyId/accept ──────────────────────────────────

router.post("/:emergencyId/accept", (req, res) => {
    const { emergencyId } = req.params
    const { responder_id } = req.body

    if (!responder_id) {
        return res.status(400).json({ error: "Missing required field: responder_id" })
    }

    // Validate responder exists
    const allResponders = responderService.getAllResponders()
    const responder = allResponders.find(r => r.id === responder_id)
    if (!responder) {
        return res.status(404).json({ error: `Responder ${responder_id} not found` })
    }

    // Update emergency status to ASSIGNED + attach responder
    const updated = emergencyService.updateEmergencyStatus(emergencyId, "ASSIGNED")
    if (!updated) {
        return res.status(404).json({ error: `Emergency ${emergencyId} not found` })
    }

    // Attach responder info to the emergency object in-memory
    const emergency = emergencyService.getEmergencies().find(e => e.event_id === emergencyId)
    if (emergency) {
        emergency.responder_id = responder_id
        emergency.responder_name = responder.name
        emergency.assigned_at = Date.now()
    }

    // Mark responder as busy
    responderService.markResponderBusy(responder_id)

    // Broadcast updated emergency (escalation timer already cancelled by updateEmergencyStatus)
    if (_io) {
        broadcastUpdateEmergency(_io, {
            ...updated,
            responder_id,
            responder_name: responder.name,
            assigned_at: Date.now(),
        })
    }

    console.log(`[COMMUNITY] ${responder.name} (${responder_id}) accepted ${emergencyId}`)

    res.json({
        ok: true,
        emergency: {
            ...updated,
            responder_id,
            responder_name: responder.name,
        },
    })
})

module.exports = { router, setIo }
