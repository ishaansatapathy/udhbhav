/**
 * Community Socket Events — real-time community alert broadcasting
 */

const responderService = require("../services/responderService")

/**
 * Register community-related socket events.
 * @param {import("socket.io").Server} io
 */
function registerCommunitySocketEvents(io) {
    io.on("connection", (socket) => {
        // Send all responders to newly connected community dashboards
        socket.emit("responder_list", responderService.getAllResponders())
    })
}

/**
 * Broadcast a community alert when nearby responders are found.
 * @param {import("socket.io").Server} io
 * @param {Object} emergency - The emergency object
 * @param {Array} nearbyResponders - Filtered list of nearby responders
 */
function broadcastCommunityAlert(io, emergency, nearbyResponders) {
    const payload = {
        emergency_id: emergency.event_id,
        emergency_details: {
            user_id: emergency.user_id,
            lat: emergency.lat,
            lng: emergency.lng,
            level: emergency.level,
            timestamp: emergency.timestamp,
        },
        nearby_responders: nearbyResponders,
    }
    io.emit("community_alert", payload)
    console.log(`[COMMUNITY] Broadcast community_alert for ${emergency.event_id} → ${nearbyResponders.length} responders`)
}

module.exports = {
    registerCommunitySocketEvents,
    broadcastCommunityAlert,
}
