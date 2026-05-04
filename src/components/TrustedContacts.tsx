/**
 * TrustedContacts — Manage emergency contacts with enable/disable and delete.
 * Talks to backend /api/contacts endpoints.
 */
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  UserPlus, Phone, Trash2, ToggleLeft, ToggleRight,
  Shield, Loader2, AlertCircle, CheckCircle2, Users, Mail,
} from "lucide-react"
import { API_BASE } from "../lib/config"

const API = `${API_BASE}/api/contacts`

interface Contact {
  id: number
  phone: string
  email?: string
  enabled: boolean
  createdAt: number
}

export default function TrustedContacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── Fetch contacts ──────────────────────────────────────────────────────
  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(API)
      if (!res.ok) throw new Error("Failed to fetch contacts")
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : [])
    } catch {
      setError("Could not load contacts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  // Clear toasts after 3s
  useEffect(() => {
    if (!error && !success) return
    const t = setTimeout(() => { setError(null); setSuccess(null) }, 3000)
    return () => clearTimeout(t)
  }, [error, success])

  // ── Add contact ─────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!phone.trim()) { setError("Enter a phone number"); return }
    setAdding(true); setError(null)
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), email: email.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Failed to add"); setAdding(false); return }
      setContacts(prev => [...prev, data])
      setPhone("")
      setEmail("")
      setSuccess("Contact added")
    } catch {
      setError("Network error")
    } finally {
      setAdding(false)
    }
  }

  // ── Toggle contact ──────────────────────────────────────────────────────
  const handleToggle = async (id: number, currentEnabled: boolean) => {
    try {
      const res = await fetch(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })
      if (!res.ok) { setError("Failed to toggle"); return }
      const updated = await res.json()
      setContacts(prev => prev.map(c => c.id === id ? updated : c))
    } catch {
      setError("Network error")
    }
  }

  // ── Delete contact ──────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API}/${id}`, { method: "DELETE" })
      if (!res.ok) { setError("Failed to delete"); return }
      setContacts(prev => prev.filter(c => c.id !== id))
      setSuccess("Contact removed")
    } catch {
      setError("Network error")
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  const enabledCount = contacts.filter(c => c.enabled).length

  return (
    <div className="emer-panel tactical-card rounded-xl overflow-hidden" style={{ opacity: 0 }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Trusted Contacts</h3>
            <p className="text-[10px] text-[#71717a] mt-0.5">
              {contacts.length === 0 ? "No contacts added yet" : `${enabledCount} active of ${contacts.length}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
          <Users className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] font-bold text-violet-400">{contacts.length}</span>
        </div>
      </div>

      {/* Add Contact Form */}
      <div className="px-5 py-4 border-b border-white/6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525b]" />
            <input
              type="tel"
              placeholder="Phone (e.g. 9876543210)"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/4 border border-white/10 text-white text-xs
                placeholder:text-[#52525b] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !phone.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all
              bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 hover:border-violet-500/50
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
            Add
          </button>
        </div>
        <div className="relative mt-2">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525b]" />
          <input
            type="email"
            placeholder="Email for alerts (optional)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white/4 border border-white/10 text-white text-xs
              placeholder:text-[#52525b] focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
          />
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {(error || success) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`flex items-center gap-2 px-5 py-2.5 text-xs font-medium ${
              error ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
            }`}>
              {error ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              {error || success}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-6 text-[#52525b] text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading contacts...
        </div>
      )}

      {/* Contact List */}
      {!loading && contacts.length === 0 && (
        <div className="py-8 text-center">
          <Users className="w-8 h-8 mx-auto text-[#3f3f46] mb-2" />
          <p className="text-[#52525b] text-xs">No trusted contacts yet</p>
          <p className="text-[#3f3f46] text-[10px] mt-1">Add a phone number above to get started</p>
        </div>
      )}

      {!loading && contacts.length > 0 && (
        <div className="divide-y divide-white/4">
          <AnimatePresence initial={false}>
            {contacts.map(contact => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, x: -40 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                  contact.enabled ? "hover:bg-white/2" : "opacity-50"
                }`}>

                  {/* Phone icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    contact.enabled
                      ? "bg-emerald-500/15 border border-emerald-500/25"
                      : "bg-white/4 border border-white/10"
                  }`}>
                    <Phone className={`w-3.5 h-3.5 ${contact.enabled ? "text-emerald-400" : "text-[#52525b]"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-mono font-semibold ${contact.enabled ? "text-white" : "text-[#71717a]"}`}>
                      {contact.phone}
                    </span>
                    {contact.email && (
                      <p className={`text-[10px] font-mono truncate ${contact.enabled ? "text-[#a1a1aa]" : "text-[#52525b]"}`}>
                        ✉ {contact.email}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                        contact.enabled
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/5 text-[#52525b] border border-white/10"
                      }`}>
                        {contact.enabled ? "ACTIVE" : "DISABLED"}
                      </span>
                    </div>
                  </div>

                  {/* Toggle button */}
                  <button
                    onClick={() => handleToggle(contact.id, contact.enabled)}
                    className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                    title={contact.enabled ? "Disable" : "Enable"}
                  >
                    {contact.enabled
                      ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                      : <ToggleLeft className="w-5 h-5 text-[#52525b]" />
                    }
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors group"
                    title="Remove contact"
                  >
                    <Trash2 className="w-4 h-4 text-[#52525b] group-hover:text-red-400 transition-colors" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Footer hint */}
      <div className="px-5 py-3 border-t border-white/4">
        <p className="text-[10px] text-[#3f3f46] leading-relaxed">
          Active contacts with email addresses will receive email alerts when SOS is triggered. Indian mobile numbers only.
        </p>
      </div>
    </div>
  )
}

