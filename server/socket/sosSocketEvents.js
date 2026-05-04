/**
 * SOS Socket Events — real-time emergency broadcasting
 * Registers socket.io event handlers for the SOS pipeline.
 */

const emergencyService = require("../services/emergencyService")

/**
 * Register SOS-related socket events on the io instance.
 * @param {import("socket.io").Server} io
 */
function registerSosSocketEvents(io) {
    io.on("connection", (socket) => {
        // On police dashboard connect: send all ACTIVE emergencies
        const active = emergencyService.getEmergencies("ACTIVE")
        if (active.length > 0) {
            socket.emit("initial_emergencies", active)
            console.log(`[SOS Socket] Sent ${active.length} active emergencies to ${socket.id}`)
        }

        // Listen for client-side SOS trigger (alternative to REST)
        socket.on("sos_trigger", (data) => {
            const emergency = emergencyService.createEmergency(data)
            io.emit("new_emergency", emergency)
        })
    })
}

/**
 * Broadcast a new emergency to all connected clients.
 * Called from the REST route after creating the emergency.
 * @param {import("socket.io").Server} io
 * @param {Object} emergency
 */
function broadcastNewEmergency(io, emergency) {
    io.emit("new_emergency", emergency)
    console.log(`[SOS Socket] Broadcast new_emergency ${emergency.event_id}`)
}

/**
 * Broadcast an updated emergency to all connected clients.
 * @param {import("socket.io").Server} io
 * @param {Object} emergency
 */
function broadcastUpdateEmergency(io, emergency) {
    io.emit("update_emergency", emergency)
    console.log(`[SOS Socket] Broadcast update_emergency ${emergency.event_id} → ${emergency.status}`)
}

module.exports = {
    registerSosSocketEvents,
    broadcastNewEmergency,
    broadcastUpdateEmergency,
}
