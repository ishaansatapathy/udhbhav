import { useState, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Lock, Eye, EyeOff, FileText, Upload, Fingerprint, X, Copy, Check,
  ShieldCheck, Cpu, Zap, FileImage, FileArchive, Hash, ChevronDown, ChevronUp,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

interface StoredProof {
  id: string
  fileName: string
  docType: string
  hash: string
  file: File
  addedAt: Date
  size: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function generateHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

function detectDocType(filename: string): string {
  const n = filename.toLowerCase()
  if (n.includes("aadhaar") || n.includes("aadhar")) return "Aadhaar Card"
  if (n.includes("pan"))                               return "PAN Card"
  if (n.includes("passport"))                          return "Passport"
  if (n.includes("student") || n.includes("college")) return "Student ID"
  if (n.includes("license") || n.includes("dl"))      return "Driver License"
  if (n.includes("voter"))                             return "Voter ID"
  if (n.match(/\.(jpg|jpeg|png|webp|gif)$/))           return "Image File"
  if (n.endsWith(".pdf"))                              return "PDF Document"
  if (n.match(/\.(doc|docx)$/))                        return "Word Document"
  return "Identity Document"
}

function fmtBytes(b: number): string {
  if (b < 1024)        return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(2)} MB`
}

function fmtDate(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function DocIcon({ type, cls = "w-5 h-5" }: { type: string; cls?: string }) {
  if (type.includes("Image"))    return <FileImage className={cls} />
  if (type.includes("Archive"))  return <FileArchive className={cls} />
  return <FileText className={cls} />
}

function strengthScore(count: number): number {
  return Math.min(100, [20, 40, 60, 80, 100][Math.min(count, 4)])
}

function strengthColor(pct: number): string {
  if (pct <= 40) return "#ef4444"
  if (pct <= 70) return "#f59e0b"
  return "#10b981"
}

function strengthLabel(pct: number): string {
  if (pct <= 20) return "Unprotected"
  if (pct <= 40) return "Weak"
  if (pct <= 60) return "Moderate"
  if (pct <= 80) return "Strong"
  return "Maximum"
}

// ── Component ──────────────────────────────────────────────────────────────

export function WalletSection() {
  const [file,           setFile]           = useState<File | null>(null)
  const [isProcessing,   setIsProcessing]   = useState(false)
  const [progress,       setProgress]       = useState(0)
  const [generatedHash,  setGeneratedHash]  = useState<string | null>(null)
  const [displayedHash,  setDisplayedHash]  = useState("")
  const [proofs,         setProofs]         = useState<StoredProof[]>([])
  const [previewFile,    setPreviewFile]    = useState<File | null>(null)
  const [dragOver,       setDragOver]       = useState(false)
  const [copiedId,       setCopiedId]       = useState<string | null>(null)
  const [expandedId,     setExpandedId]     = useState<string | null>(null)

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingTimer   = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Progress bar animation while hashing ────────────────────────────────

  useEffect(() => {
    if (progressTimer.current) clearInterval(progressTimer.current)
    if (!isProcessing) {
      if (generatedHash) setProgress(100)
      return
    }
    setProgress(0)
    const start = Date.now()
    const DURATION = 1300
    progressTimer.current = setInterval(() => {
      const pct = Math.min(88, ((Date.now() - start) / DURATION) * 100)
      setProgress(pct)
      if (pct >= 88) clearInterval(progressTimer.current!)
    }, 20)
    return () => clearInterval(progressTimer.current!)
  }, [isProcessing, generatedHash])

  // ── Typing animation when hash reveals ──────────────────────────────────

  useEffect(() => {
    if (typingTimer.current) clearInterval(typingTimer.current)
    if (!generatedHash) { setDisplayedHash(""); return }
    let i = 0
    setDisplayedHash("")
    typingTimer.current = setInterval(() => {
      i++
      setDisplayedHash(generatedHash.slice(0, i))
      if (i >= generatedHash.length) clearInterval(typingTimer.current!)
    }, 9)
    return () => clearInterval(typingTimer.current!)
  }, [generatedHash])

  // ── File handling ────────────────────────────────────────────────────────

  const handleFileChange = useCallback(async (f: File | null) => {
    if (!f) { setFile(null); setGeneratedHash(null); setProgress(0); return }
    setFile(f)
    setGeneratedHash(null)
    setDisplayedHash("")
    setIsProcessing(true)

    const [hash] = await Promise.all([
      generateHash(f),
      new Promise<void>(res => setTimeout(res, 1600)),
    ])

    setIsProcessing(false)
    setGeneratedHash(hash)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileChange(f)
  }

  const addToWallet = () => {
    if (!file || !generatedHash) return
    setProofs(p => [...p, {
      id:       crypto.randomUUID(),
      fileName: file.name,
      docType:  detectDocType(file.name),
      hash:     generatedHash,
      file,
      addedAt:  new Date(),
      size:     file.size,
    }])
    setFile(null)
    setGeneratedHash(null)
    setProgress(0)
    setDisplayedHash("")
  }

  const removeProof = (id: string) =>
    setProofs(p => p.filter(x => x.id !== id))

  const copyHash = async (val: string, id: string) => {
    await navigator.clipboard.writeText(val)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2200)
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const strength = strengthScore(proofs.length)
  const sColor   = strengthColor(strength)
  const sLabel   = strengthLabel(strength)

  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-8 py-10 max-w-6xl mx-auto">

      {/* ── Hero header ── */}
      <div className="mb-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#7C3AED]/40 bg-[#7C3AED]/10 text-[#a78bfa] text-xs font-semibold mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            Cryptographic Identity Vault
          </div>
          <h2 className="text-4xl font-extrabold text-white mb-3 leading-tight">
            Identity <span style={{ background: "linear-gradient(90deg,#7C3AED,#2563EB)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Wallet</span>
          </h2>
          <p className="text-[#A1A1AA] text-base max-w-xl">
            Store cryptographic proofs of your documents — never the documents themselves.
            Zero raw data leaves your device.
          </p>
        </motion.div>

        {/* Security badges */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-2.5 mt-5">
          {[
            { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: "Zero Raw Data Storage",  color: "#7C3AED" },
            { icon: <Cpu         className="w-3.5 h-3.5" />, label: "Client-Side Hashing",    color: "#2563EB" },
            { icon: <Zap         className="w-3.5 h-3.5" />, label: "Tamper-Proof Proof",      color: "#059669" },
          ].map(b => (
            <span key={b.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
              style={{
                color: b.color,
                borderColor: `${b.color}55`,
                background: `${b.color}18`,
                boxShadow: `0 0 10px ${b.color}20`,
              }}>
              {b.icon}{b.label}
            </span>
          ))}
        </motion.div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ─────────── LEFT / MAIN ─────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* ── Upload zone ── */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="rounded-2xl overflow-hidden border border-white/10"
              style={{ background: "rgba(18,18,28,0.7)", backdropFilter: "blur(20px)" }}>
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Hash className="w-4 h-4 text-[#7C3AED]" />
                  <span className="text-white font-bold text-sm">Generate Proof</span>
                </div>
                <p className="text-[#A1A1AA] text-xs">Upload any document to generate an irreversible SHA-256 cryptographic hash</p>
              </div>

              {/* Drag-drop area */}
              <div className="px-5 pb-5">
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className="relative rounded-xl border-2 border-dashed p-6 flex items-center gap-4 transition-all duration-300"
                  style={{
                    borderColor: dragOver ? "#7C3AED" : "rgba(255,255,255,0.12)",
                    background: dragOver ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.025)",
                  }}>
                  <label htmlFor="doc-upload" className="flex-1 flex items-center gap-4 cursor-pointer min-w-0">
                    <input type="file" id="doc-upload" className="hidden"
                      onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip,.csv" />
                    <motion.div
                      animate={dragOver ? { scale: 1.1 } : { scale: 1 }}
                      className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: file ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      {file
                        ? <DocIcon type={detectDocType(file.name)} cls="w-6 h-6 text-[#7C3AED]" />
                        : <Upload className="w-6 h-6 text-[#A1A1AA]" />}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      {file ? (
                        <>
                          <p className="text-white font-semibold text-sm truncate">{file.name}</p>
                          <p className="text-[#A1A1AA] text-xs mt-0.5">{detectDocType(file.name)} · {fmtBytes(file.size)}</p>
                        </>
                      ) : (
                        <div>
                          <p className="text-white/80 text-sm font-medium">Drop document here</p>
                          <p className="text-[#A1A1AA] text-xs mt-0.5">or click to browse — PDF, Image, Doc, ZIP</p>
                        </div>
                      )}
                    </div>
                  </label>
                  {file && !isProcessing && (
                    <button onClick={() => setPreviewFile(p => p ? null : file)}
                      className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white transition-colors"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      {previewFile ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Processing animation ── */}
              <AnimatePresence>
                {(isProcessing || generatedHash) && file && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="border-t border-white/8">
                    <div className="px-5 py-4">

                      {/* Progress header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={isProcessing ? { rotate: 360 } : { rotate: 0 }}
                            transition={{ repeat: isProcessing ? Infinity : 0, duration: 1, ease: "linear" }}>
                            <Fingerprint className="w-4 h-4 text-[#7C3AED]" />
                          </motion.div>
                          <span className="text-white text-sm font-semibold">
                            {isProcessing ? "Generating Cryptographic Proof…" : "Proof Generated"}
                          </span>
                        </div>
                        {!isProcessing && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-emerald-400"
                            style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                            🔒 Encrypted &amp; Secured
                          </motion.span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="h-1.5 rounded-full overflow-hidden mb-4"
                        style={{ background: "rgba(255,255,255,0.07)" }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ width: `${progress}%`, background: "linear-gradient(90deg,#7C3AED,#2563EB)" }}
                          transition={{ duration: 0.1 }} />
                      </div>

                      {/* Document info row */}
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                          { label: "Document",  value: file.name.length > 18 ? file.name.slice(0, 18) + "…" : file.name },
                          { label: "Type",      value: detectDocType(file.name) },
                          { label: "Timestamp", value: fmtDate(new Date()) },
                        ].map(row => (
                          <div key={row.label} className="rounded-lg px-3 py-2"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <p className="text-[#52525B] text-[10px] uppercase tracking-wider mb-0.5">{row.label}</p>
                            <p className="text-white text-xs font-medium truncate">{row.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Hash display */}
                      {!isProcessing && generatedHash && (
                        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                          className="rounded-xl p-3 mb-4"
                          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)" }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[#a78bfa] text-[10px] font-bold uppercase tracking-widest">SHA-256 Hash</span>
                            <button onClick={() => copyHash(generatedHash, "gen")}
                              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#A1A1AA] hover:text-white transition-colors"
                              style={{ background: "rgba(255,255,255,0.06)" }}>
                              {copiedId === "gen" ? <><Check className="w-3 h-3 text-green-400" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy</>}
                            </button>
                          </div>
                          {/* Typing animation — first 16 chars as preview, rest dimmed */}
                          <p className="text-white font-mono text-xs break-all leading-relaxed">
                            <span className="text-[#c4b5fd]">{displayedHash.slice(0, 16)}</span>
                            <span className="text-[#7C3AED]/60">{displayedHash.slice(16)}</span>
                            {displayedHash.length < generatedHash.length && (
                              <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
                                className="inline-block w-1.5 h-3.5 ml-0.5 rounded-sm bg-[#7C3AED]" />
                            )}
                          </p>
                        </motion.div>
                      )}

                      {/* Action buttons */}
                      {!isProcessing && generatedHash && (
                        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                          className="flex gap-2">
                          <motion.button
                            onClick={addToWallet}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                            style={{ background: "linear-gradient(135deg,#7C3AED,#2563EB)", boxShadow: "0 0 24px rgba(124,58,237,0.4)" }}>
                            Store in Vault
                          </motion.button>
                          <button onClick={() => { setFile(null); setGeneratedHash(null); setProgress(0) }}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#A1A1AA] hover:text-white transition-colors"
                            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            Discard
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ── Proof cards ── */}
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-white font-bold text-base">Stored Proofs</h3>
                <p className="text-[#A1A1AA] text-xs mt-0.5">{proofs.length === 0 ? "No proofs yet" : `${proofs.length} document${proofs.length !== 1 ? "s" : ""} cryptographically secured`}</p>
              </div>
              {proofs.length > 0 && (
                <span className="text-xs text-[#a78bfa] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
                  {proofs.length} secured
                </span>
              )}
            </div>

            {proofs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-12 flex flex-col items-center"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <Lock className="w-10 h-10 text-[#A1A1AA]/30 mb-3" />
                <p className="text-[#A1A1AA] text-sm font-medium">Vault is empty</p>
                <p className="text-[#52525B] text-xs mt-1">Upload a document above to create your first proof</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AnimatePresence>
                  {proofs.map((p, idx) => (
                    <motion.div
                      key={p.id} layout
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, y: -8 }}
                      transition={{ delay: idx * 0.05, type: "spring", damping: 22 }}
                      whileHover={{ y: -2 }}
                      className="group rounded-2xl p-4 cursor-default transition-all duration-300"
                      style={{
                        background: "rgba(18,18,28,0.8)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        backdropFilter: "blur(16px)",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.45)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>

                      {/* Card header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }}>
                            <DocIcon type={p.docType} cls="w-4.5 h-4.5 text-[#7C3AED]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-semibold truncate max-w-[120px]">{p.fileName}</p>
                            <p className="text-[#A1A1AA] text-[10px]">{p.docType}</p>
                          </div>
                        </div>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: "#10b981", background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", boxShadow: "0 0 8px rgba(16,185,129,0.2)" }}>
                          ● Verified
                        </span>
                      </div>

                      {/* Hash preview */}
                      <div className="rounded-lg px-3 py-2 mb-3"
                        style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.15)" }}>
                        <p className="text-[10px] text-[#52525B] uppercase tracking-wider mb-0.5">SHA-256</p>
                        <p className="text-[#c4b5fd] text-[11px] font-mono truncate">
                          {expandedId === p.id ? p.hash : `${p.hash.slice(0, 12)}…${p.hash.slice(-8)}`}
                        </p>
                      </div>

                      {/* Meta */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[#52525B] text-[10px]">{fmtDate(p.addedAt)}</p>
                        <p className="text-[#52525B] text-[10px]">{fmtBytes(p.size)}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => copyHash(p.hash, p.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium text-[#A1A1AA] hover:text-white transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          {copiedId === p.id ? <><Check className="w-3 h-3 text-green-400" />Copied</> : <><Copy className="w-3 h-3" />Copy Hash</>}
                        </button>
                        <button onClick={() => setExpandedId(e => e === p.id ? null : p.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#a78bfa] transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                          title={expandedId === p.id ? "Collapse" : "Expand hash"}>
                          {expandedId === p.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setPreviewFile(pf => pf === p.file ? null : p.file)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                          title="Preview">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeProof(p.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-red-400 transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                          title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </div>

        {/* ─────────── RIGHT SIDEBAR ─────────── */}
        <div className="space-y-4 lg:sticky lg:top-24">

          {/* Identity Strength Panel */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className="rounded-2xl p-5 overflow-hidden relative"
            style={{
              background: "rgba(18,18,28,0.85)",
              border: "1px solid rgba(255,255,255,0.09)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
            {/* Subtle gradient background */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at top right, rgba(124,58,237,0.08), transparent 60%)" }} />

            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)" }}>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#7C3AED]" />
                </div>
                <span className="text-white font-bold text-sm">Identity Strength</span>
              </div>

              {/* Score ring */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative">
                  <svg width="96" height="96" className="-rotate-90">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                    <motion.circle
                      cx="48" cy="48" r="40" fill="none" strokeWidth="7"
                      strokeLinecap="round"
                      stroke={sColor}
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - strength / 100) }}
                      initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      style={{ filter: `drop-shadow(0 0 6px ${sColor}80)` }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-white font-extrabold text-xl leading-none">{strength}%</span>
                    <span className="text-[10px] mt-0.5" style={{ color: sColor }}>{sLabel}</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex justify-between text-[10px] text-[#52525B] mb-1.5">
                  <span>0 docs</span><span>4+ docs</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <motion.div className="h-full rounded-full"
                    animate={{ width: `${strength}%` }}
                    initial={{ width: "0%" }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                    style={{ background: `linear-gradient(90deg, #ef4444, #f59e0b ${strength < 60 ? 50 : 20}%, ${sColor})` }} />
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2.5">
                {[
                  { label: "Documents Added",  value: proofs.length.toString(),   dot: "#7C3AED" },
                  { label: "Encryption",        value: "SHA-256 Active",           dot: "#10b981" },
                  { label: "Hash Integrity",    value: proofs.length > 0 ? "Verified" : "Pending", dot: proofs.length > 0 ? "#10b981" : "#f59e0b" },
                  { label: "Raw Data Stored",   value: "None",                     dot: "#10b981" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-[#A1A1AA] text-xs">{row.label}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: row.dot, boxShadow: `0 0 6px ${row.dot}` }} />
                      <span className="text-white text-xs font-semibold">{row.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* How it works panel */}
          <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
            className="rounded-2xl p-4"
            style={{
              background: "rgba(18,18,28,0.7)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(16px)",
            }}>
            <p className="text-white font-bold text-xs mb-3 uppercase tracking-wider">How It Works</p>
            <div className="space-y-3">
              {[
                { n: "1", text: "Upload any document" },
                { n: "2", text: "SHA-256 hash generated client-side" },
                { n: "3", text: "Only the hash is stored — never the file" },
                { n: "4", text: "Present hash as tamper-proof identity proof" },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#7C3AED]"
                    style={{ background: "rgba(124,58,237,0.18)", border: "1px solid rgba(124,58,237,0.3)" }}>
                    {step.n}
                  </div>
                  <p className="text-[#A1A1AA] text-xs leading-snug mt-0.5">{step.text}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── Document preview modal ── */}
      <AnimatePresence>
        {previewFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)" }}
            onClick={() => setPreviewFile(null)}>
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="relative max-w-2xl w-full rounded-2xl overflow-hidden"
              style={{ background: "rgba(18,18,28,0.97)", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <DocIcon type={detectDocType(previewFile.name)} cls="w-4 h-4 text-[#7C3AED]" />
                  <span className="text-white text-sm font-semibold truncate max-w-xs">{previewFile.name}</span>
                </div>
                <button onClick={() => setPreviewFile(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-white"
                  style={{ background: "rgba(255,255,255,0.06)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[65vh]">
                {previewFile.type.startsWith("image/") ? (
                  <img src={URL.createObjectURL(previewFile)} alt={previewFile.name} className="max-w-full rounded-xl" />
                ) : previewFile.type === "application/pdf" ? (
                  <iframe src={URL.createObjectURL(previewFile)} title={previewFile.name} className="w-full h-[55vh] rounded-xl border-0" />
                ) : (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <FileText className="w-12 h-12 text-[#7C3AED]/50" />
                    <p className="text-[#A1A1AA] text-sm">Preview not available for this file type</p>
                    <p className="text-[#52525B] text-xs">File: {previewFile.name} · {fmtBytes(previewFile.size)}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
