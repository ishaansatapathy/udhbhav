/**
 * Emergency Service — in-memory SOS state management
 * Single source of truth for all active emergencies.
 * Includes automatic escalation engine.
 */

const { randomUUID } = require("crypto")

/** @type {Array<Object>} */
const activeEmergencies = []

/** @type {Map<string, NodeJS.Timeout>} escalation timers keyed by event_id */
const escalationTimers = new Map()

/** Default auto-escalation timeout in ms (2 minutes) */
const ESCALATION_TIMEOUT_MS = 2 * 60 * 1000

/**
 * Broadcast callback — set once from server.js via setEscalationBroadcast().
 * Called when auto-escalation fires to emit update_emergency via Socket.io.
 * @type {((emergency: Object) => void) | null}
 */
let _onEscalate = null

/**
 * onCreate callback — called after every new emergency is created.
 * Used by the community response layer to trigger proximity alerts.
 * @type {((emergency: Object) => void) | null}
 */
let _onCreate = null

/**
 * Register the Socket.io broadcast callback for auto-escalation.
 * Must be called once during server startup.
 * @param {(emergency: Object) => void} callback
 */
function setEscalationBroadcast(callback) {
    _onEscalate = callback
}

/**
 * Register a callback that fires after every new emergency.
 * @param {(emergency: Object) => void} callback
 */
function setOnCreateCallback(callback) {
    _onCreate = callback
}

/**
 * Create a new SOS emergency event.
 * Starts an auto-escalation timer.
 * @param {{ user_id: string, lat: number, lng: number, level: "LOW"|"MEDIUM"|"HIGH" }} data
 * @returns {Object} The created emergency object
 */
function createEmergency({ user_id, lat, lng, level, category }) {
    const emergency = {
        event_id: `SOS_${randomUUID().slice(0, 8).toUpperCase()}`,
        user_id,
        lat,
        lng,
        level,
        category: category || null,
        status: "ACTIVE",
        timestamp: Date.now(),
    }
    activeEmergencies.push(emergency)
    console.log(`[SOS] Created ${emergency.event_id}  user=${user_id}  level=${level}`)

    // Start auto-escalation timer
    startEscalationTimer(emergency.event_id)

    // Trigger onCreate callback (community alerts)
    if (_onCreate) _onCreate(emergency)

    return emergency
}

/**
 * Get all emergencies with a given status.
 * @param {"ACTIVE"|"RESOLVED"|"ESCALATED"} [status]
 * @returns {Array<Object>}
 */
function getEmergencies(status) {
    if (!status) return [...activeEmergencies]
    return activeEmergencies.filter(e => e.status === status)
}

/**
 * Update an emergency's status by event_id.
 * Cancels any pending escalation timer if resolved manually.
 * @param {string} eventId
 * @param {"RESOLVED"|"ESCALATED"|"ASSIGNED"} newStatus
 * @returns {Object|null} Updated emergency or null if not found
 */
function updateEmergencyStatus(eventId, newStatus) {
    const emergency = activeEmergencies.find(e => e.event_id === eventId)
    if (!emergency) return null

    emergency.status = newStatus
    emergency.updated_at = Date.now()
    console.log(`[SOS] Updated ${eventId} → ${newStatus}`)

    // Cancel escalation timer (whether resolved or manually escalated)
    cancelEscalationTimer(eventId)

    return { ...emergency }
}

// ── Escalation Engine (private) ─────────────────────────────────────────────

/**
 * Start an auto-escalation timer for the given emergency.
 * If still ACTIVE after ESCALATION_TIMEOUT_MS, auto-escalate and broadcast.
 * @param {string} eventId
 */
function startEscalationTimer(eventId) {
    // Clear any existing timer (safety)
    cancelEscalationTimer(eventId)

    const timer = setTimeout(() => {
        const emergency = activeEmergencies.find(e => e.event_id === eventId)
        if (!emergency || emergency.status !== "ACTIVE") {
            // Already resolved or escalated — nothing to do
            escalationTimers.delete(eventId)
            return
        }

        // Auto-escalate
        emergency.status = "ESCALATED"
        emergency.updated_at = Date.now()
        emergency.auto_escalated = true
        escalationTimers.delete(eventId)

        console.log(`[SOS] ⚠ Auto-escalated ${eventId} (unresolved after ${ESCALATION_TIMEOUT_MS / 1000}s)`)

        // Broadcast via Socket.io
        if (_onEscalate) {
            _onEscalate({ ...emergency })
        }
    }, ESCALATION_TIMEOUT_MS)

    escalationTimers.set(eventId, timer)
    console.log(`[SOS] Escalation timer started for ${eventId} (${ESCALATION_TIMEOUT_MS / 1000}s)`)
}

/**
 * Cancel a pending escalation timer.
 * @param {string} eventId
 */
function cancelEscalationTimer(eventId) {
    const timer = escalationTimers.get(eventId)
    if (timer) {
        clearTimeout(timer)
        escalationTimers.delete(eventId)
        console.log(`[SOS] Escalation timer cancelled for ${eventId}`)
    }
}

module.exports = {
    createEmergency,
    getEmergencies,
    updateEmergencyStatus,
    setEscalationBroadcast,
    setOnCreateCallback,
}
