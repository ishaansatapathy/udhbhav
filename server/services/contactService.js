/**
 * contactService.js — In-memory Trusted Contacts store.
 *
 * Each contact: { id, phone, enabled, createdAt }
 * Used by routes/contacts.js for CRUD and by SOS logic to retrieve
 * active contacts for SMS alerts.
 */

let trustedContacts = []
let nextId = 1

// ── Pre-seed a default trusted contact so email alerts work out of the box ──
;(function seedDefaults() {
  trustedContacts.push({
    id: nextId++,
    phone: "+919876543210",
    email: "ishaansatapathy09@gmail.com",
    enabled: true,
    createdAt: Date.now(),
  })
})()

/** Indian mobile: 10 digits, optional +91 / 0 prefix */
const PHONE_RE = /^(?:\+91|0)?[6-9]\d{9}$/

/**
 * Normalise phone to +91XXXXXXXXXX format.
 */
function normalisePhone(raw) {
  const digits = raw.replace(/[\s\-()]/g, "")
  if (/^\+91\d{10}$/.test(digits)) return digits
  if (/^0\d{10}$/.test(digits)) return "+91" + digits.slice(1)
  if (/^[6-9]\d{9}$/.test(digits)) return "+91" + digits
  return null
}

/**
 * Validate phone format.
 * @returns {{ valid: boolean, normalised?: string, error?: string }}
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== "string")
    return { valid: false, error: "Phone number is required" }

  const cleaned = phone.replace(/[\s\-()]/g, "")
  if (!PHONE_RE.test(cleaned))
    return { valid: false, error: "Invalid Indian mobile number" }

  const normalised = normalisePhone(cleaned)
  if (!normalised)
    return { valid: false, error: "Could not normalise phone number" }

  // Duplicate check
  if (trustedContacts.some((c) => c.phone === normalised))
    return { valid: false, error: "Contact already exists" }

  return { valid: true, normalised }
}

/**
 * Add a new trusted contact.
 * @returns {{ contact?: object, error?: string }}
 */
function addContact(phone, email) {
  const check = validatePhone(phone)
  if (!check.valid) return { error: check.error }

  const contact = {
    id: nextId++,
    phone: check.normalised,
    email: email && typeof email === "string" ? email.trim().toLowerCase() : undefined,
    enabled: true,
    createdAt: Date.now(),
  }
  trustedContacts.push(contact)
  return { contact }
}

/**
 * Return all trusted contacts.
 */
function getContacts() {
  return trustedContacts
}

/**
 * Return only enabled contacts (used when sending SMS alerts).
 */
function getEnabledContacts() {
  return trustedContacts.filter((c) => c.enabled)
}

/**
 * Toggle enabled/disabled for a contact.
 * @returns {{ contact?: object, error?: string }}
 */
function toggleContact(id, enabled) {
  const contact = trustedContacts.find((c) => c.id === id)
  if (!contact) return { error: "Contact not found" }

  contact.enabled = typeof enabled === "boolean" ? enabled : !contact.enabled
  return { contact }
}

/**
 * Delete a contact by id.
 * @returns {{ success: boolean, error?: string }}
 */
function deleteContact(id) {
  const idx = trustedContacts.findIndex((c) => c.id === id)
  if (idx === -1) return { success: false, error: "Contact not found" }

  trustedContacts.splice(idx, 1)
  return { success: true }
}

module.exports = {
  addContact,
  getContacts,
  getEnabledContacts,
  toggleContact,
  deleteContact,
}
