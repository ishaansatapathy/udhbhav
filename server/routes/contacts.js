/**
 * routes/contacts.js — Trusted Contacts CRUD endpoints.
 *
 * POST   /api/contacts       → Add a new contact
 * GET    /api/contacts        → List all contacts
 * PATCH  /api/contacts/:id    → Toggle enabled/disabled
 * DELETE /api/contacts/:id    → Remove contact
 */

const express = require("express")
const router = express.Router()
const contactService = require("../services/contactService")

// ── POST /api/contacts ────────────────────────────────────────────────────────
router.post("/", (req, res) => {
  const { phone, email } = req.body

  const result = contactService.addContact(phone, email)
  if (result.error) {
    return res.status(400).json({ error: result.error })
  }
  res.status(201).json(result.contact)
})

// ── GET /api/contacts ─────────────────────────────────────────────────────────
router.get("/", (_req, res) => {
  res.json(contactService.getContacts())
})

// ── PATCH /api/contacts/:id ───────────────────────────────────────────────────
router.patch("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: "Invalid contact id" })

  const { enabled } = req.body
  const result = contactService.toggleContact(id, enabled)
  if (result.error) {
    return res.status(404).json({ error: result.error })
  }
  res.json(result.contact)
})

// ── DELETE /api/contacts/:id ──────────────────────────────────────────────────
router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10)
  if (isNaN(id)) return res.status(400).json({ error: "Invalid contact id" })

  const result = contactService.deleteContact(id)
  if (result.error) {
    return res.status(404).json({ error: result.error })
  }
  res.json({ success: true })
})

module.exports = router
