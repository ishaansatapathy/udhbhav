/**
 * emailService.js — Send real email alerts to enabled trusted contacts
 * using Gmail SMTP via Nodemailer.
 *
 * Environment variables required:
 *   EMAIL_USER  — Gmail address (e.g. saarthi.alerts@gmail.com)
 *   EMAIL_PASS  — Gmail App Password (16-char)
 */

const nodemailer = require("nodemailer")
const { getEnabledContacts } = require("./contactService")

// ── Gmail SMTP transporter (lazy-init so env vars are loaded) ────────────────

let _transporter = null
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }
  return _transporter
}

/**
 * Build the HTML email body for an emergency alert.
 */
function buildEmailBody(emergency) {
  const { lat, lng, level, category, user_id, created_at } = emergency
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`
  const time = new Date(created_at || Date.now()).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
  })

  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#18181b;color:#e4e4e7;border-radius:12px;border:1px solid #ef4444;">
      <h2 style="margin:0 0 16px;color:#ef4444;font-size:22px;">🚨 SAARTHI Emergency Alert</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#a1a1aa;font-size:13px;">Status</td>
          <td style="padding:8px 0;font-weight:bold;color:#ef4444;font-size:13px;">🔴 ACTIVE</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#a1a1aa;font-size:13px;">Severity</td>
          <td style="padding:8px 0;font-weight:bold;color:#f59e0b;font-size:13px;">${level || "HIGH"}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#a1a1aa;font-size:13px;">Category</td>
          <td style="padding:8px 0;color:#e4e4e7;font-size:13px;">${category || "PERSONAL_THREAT"}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#a1a1aa;font-size:13px;">Time</td>
          <td style="padding:8px 0;color:#e4e4e7;font-size:13px;">${time}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#a1a1aa;font-size:13px;">User</td>
          <td style="padding:8px 0;color:#e4e4e7;font-size:13px;">${user_id}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#a1a1aa;font-size:13px;">Location</td>
          <td style="padding:8px 0;font-size:13px;">
            <a href="${mapsUrl}" style="color:#38bdf8;text-decoration:underline;">${lat.toFixed(5)}, ${lng.toFixed(5)}</a>
          </td>
        </tr>
      </table>
      <div style="margin-top:20px;">
        <a href="${mapsUrl}" style="display:inline-block;padding:10px 24px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">
          📍 View on Google Maps
        </a>
      </div>
      <p style="margin-top:20px;font-size:11px;color:#52525b;">
        This is an automated emergency alert from Saarthi Safety Platform. If you received this in error, please disregard.
      </p>
    </div>
  `
}

/**
 * Send emergency email alerts to ALL enabled trusted contacts.
 * Uses Promise.allSettled so one failure doesn't block others.
 *
 * @param {object} emergency — { lat, lng, level, category, user_id, created_at, ... }
 * @returns {Promise<{ sent: number, failed: number, details: Array }>}
 */
async function sendEmailToContacts(emergency) {
  const contacts = getEnabledContacts()

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[emailService] EMAIL_USER / EMAIL_PASS not set — skipping email alerts")
    return { sent: 0, failed: 0, details: [], skipped: true }
  }
  if (process.env.EMAIL_USER.includes("your_") || process.env.EMAIL_PASS.includes("your_")) {
    console.error("[emailService] ⚠️  EMAIL_USER or EMAIL_PASS still has placeholder values! Update .env with real Gmail credentials.")
    return { sent: 0, failed: 0, details: [], skipped: true }
  }

  if (contacts.length === 0) {
    console.log("[emailService] No enabled trusted contacts — nothing to send")
    return { sent: 0, failed: 0, details: [] }
  }

  const subject = "🚨 SAARTHI Emergency Alert"
  const html = buildEmailBody(emergency)

  const promises = contacts.map((contact) => {
    // Contacts store phone numbers; for email demo we treat them as email
    // addresses if they contain '@', otherwise skip.
    // In production this would go through an SMS gateway for phone numbers.
    const to = contact.email || contact.phone
    if (!to.includes("@")) {
      return Promise.resolve({ status: "skipped", phone: to, reason: "No email address" })
    }

    return getTransporter().sendMail({
      from: `"Saarthi Safety" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    })
  })

  const results = await Promise.allSettled(promises)

  let sent = 0
  let failed = 0
  const details = results.map((r, i) => {
    if (r.status === "fulfilled" && r.value?.messageId) {
      sent++
      return { contact: contacts[i].phone, status: "sent", messageId: r.value.messageId }
    } else if (r.status === "fulfilled" && r.value?.status === "skipped") {
      return { contact: contacts[i].phone, status: "skipped", reason: r.value.reason }
    } else {
      failed++
      return { contact: contacts[i].phone, status: "failed", error: r.reason?.message || "Unknown error" }
    }
  })

  console.log(`[emailService] Email alerts: ${sent} sent, ${failed} failed, ${contacts.length} total contacts`)
  return { sent, failed, details }
}

module.exports = { sendEmailToContacts }
