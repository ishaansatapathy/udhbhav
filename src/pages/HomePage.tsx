import { useRef, useEffect, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Link } from "react-router-dom"
import * as THREE from "three"
import { Lock, Car, Radio, Shield, MapPin, AlertTriangle, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react"
import TacticalNav from "../components/TacticalNav"
import { useHeroEntrance, useSectionReveal, useGlitchText, useFloatingElement } from "../lib/useAnimeAnimations"

// ── Subtle particle layer ───────────────────────────────────────────────
function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const init = () => {
      const W = canvas.offsetWidth || window.innerWidth
      const H = canvas.offsetHeight || window.innerHeight
      if (!W || !H) return

      let renderer: THREE.WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
      } catch { return }

      renderer.setSize(W, H)
      renderer.setPixelRatio(1)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200)
      camera.position.set(0, 0, 8)

      const COUNT = 600
      const pos = new Float32Array(COUNT * 3)
      const vel: number[] = []
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 28
        pos[i * 3 + 1] = (Math.random() - 0.5) * 18
        pos[i * 3 + 2] = (Math.random() - 0.5) * 6
        vel.push((Math.random() - 0.5) * 0.0008, (Math.random() - 0.5) * 0.0008, 0)
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      scene.add(new THREE.Points(geo,
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.030, transparent: true, opacity: 0.30, sizeAttenuation: true })
      ))

      const onResize = () => {
        const w = canvas.offsetWidth || window.innerWidth
        const h = canvas.offsetHeight || window.innerHeight
        if (!w || !h) return
        renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
      }
      window.addEventListener("resize", onResize)

      let id: number
      const tick = () => {
        id = requestAnimationFrame(tick)
        const p = geo.attributes.position.array as Float32Array
        for (let i = 0; i < COUNT; i++) {
          p[i * 3] += vel[i * 3]
          p[i * 3 + 1] += vel[i * 3 + 1]
          if (Math.abs(p[i * 3]) > 14) vel[i * 3] *= -1
          if (Math.abs(p[i * 3 + 1]) > 9) vel[i * 3 + 1] *= -1
        }
        geo.attributes.position.needsUpdate = true
        renderer.render(scene, camera)
      }
      tick()

        ; (canvas as HTMLCanvasElement & { _cleanup?: () => void })._cleanup = () => {
          cancelAnimationFrame(id)
          window.removeEventListener("resize", onResize)
          renderer.dispose()
        }
    }

    const raf = requestAnimationFrame(init)
    return () => {
      cancelAnimationFrame(raf)
      const c = canvas as HTMLCanvasElement & { _cleanup?: () => void }
      c._cleanup?.()
    }
  }, [canvasRef])
}

// ── Main component ──────────────────────────────────────────────────────
export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scrollY, setScrollY] = useState(0)

  // Anime.js hooks
  const heroRef = useHeroEntrance()
  const belowFoldRef = useSectionReveal()
  const footerBrandRef = useRef<HTMLSpanElement>(null)
  const scrollIndicatorRef = useRef<HTMLDivElement>(null)

  // Apply anime.js hooks
  useGlitchText(footerBrandRef, 5000)
  useFloatingElement(scrollIndicatorRef, 6)

  useParticles(canvasRef)

  useEffect(() => {
    const v = videoRef.current
    if (v) { v.playbackRate = 0.7 }
  }, [])

  useEffect(() => {
    const onScroll = () => { setScrollY(window.scrollY) }
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Split title into individual letter spans for anime.js stagger
  const titleLetters = "SAARTHI".split("").map((letter, i) => (
    <span key={i} className="hero-letter inline-block" style={{ opacity: 0 }}>
      {letter}
    </span>
  ))

  return (
    <div className="min-h-screen relative overflow-x-hidden noise-overlay" style={{ background: "#000" }}>

      {/* ── Premium Tactical Navbar ── */}
      <TacticalNav />

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative h-screen w-full overflow-hidden"
        style={{ background: "#0a0a0e" }}>

        {/* ── BG video – Krishna chakra ── */}
        <video
          ref={videoRef}
          src="/chakra.mp4"
          autoPlay loop muted playsInline
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            zIndex: 5,
            filter: "grayscale(100%) brightness(55%) contrast(115%)",
          }} />

        {/* ── Cinematic gradient overlay ── */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 10,
          background: `
            linear-gradient(
              to bottom,
              rgba(0,0,0,0.70) 0%,
              rgba(0,0,0,0.20) 35%,
              rgba(0,0,0,0.20) 55%,
              rgba(0,0,0,0.85) 100%
            )
          `,
        }} />

        {/* ── Left-edge depth fade ── */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 11,
          background: "linear-gradient(to right, rgba(0,0,0,0.60) 0%, transparent 50%)",
        }} />

        {/* ── Cinematic vignette ── */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 12,
          background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 50%, rgba(0,0,0,0.5) 100%)",
        }} />

        {/* ── Subtle particles ── */}
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 15, opacity: 0.18 }} />

        {/* ── Violet accent glow ── */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 16,
          background: "radial-gradient(ellipse 40% 50% at 18% 60%, rgba(139,92,246,0.12) 0%, transparent 70%)",
        }} />

        {/* ── Bottom violet glow accent ── */}
        <div className="absolute inset-0 pointer-events-none" style={{
          zIndex: 16,
          background: "radial-gradient(ellipse 50% 25% at 50% 95%, rgba(124,58,237,0.08) 0%, transparent 70%)",
        }} />

        {/* ── Content: anime.js managed entrance ── */}
        <div ref={heroRef} className="absolute inset-0 flex items-center" style={{ zIndex: 50 }}>
          <div className="w-full max-w-7xl mx-auto px-8 md:px-16">
            <div
              className="max-w-[620px] select-none"
              style={{ transform: `translateY(${scrollY * 0.08}px)` }}>

              {/* Status badge — anime.js: .hero-badge */}
              <div className="hero-badge inline-flex items-center gap-2.5 mb-8 px-3 py-1.5 rounded-full" 
                style={{ 
                  opacity: 0,
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}>
                <span className="w-2 h-2 rounded-full bg-[#8b5cf6] pulse-dot" />
                <span className="text-white/55 text-[10px] font-semibold tracking-[0.28em] uppercase">
                  Digital Safety Infrastructure
                </span>
              </div>

              {/* Main heading — anime.js letter stagger: .hero-letter */}
              <h1
                className="font-black uppercase leading-none mb-5 text-white"
                style={{
                  fontSize: "clamp(3rem, 7.5vw, 7.5rem)",
                  letterSpacing: "0.26em",
                  textShadow: "0 0 80px rgba(139,92,246,0.5), 0 4px 60px rgba(0,0,0,0.9)",
                  whiteSpace: "nowrap",
                }}>
                {titleLetters}
              </h1>

              {/* Subheading — anime.js: .hero-subtitle */}
              <p
                className="hero-subtitle font-light uppercase mb-4"
                style={{
                  fontSize: "clamp(0.65rem, 1.2vw, 0.82rem)",
                  letterSpacing: "0.24em",
                  color: "rgba(255,255,255,0.45)",
                  opacity: 0,
                }}>
                Privacy-First Digital Safety Infrastructure
              </p>

              {/* Brief description — anime.js: .hero-desc */}
              <p
                className="hero-desc mb-6"
                style={{
                  fontSize: "clamp(0.85rem, 1.15vw, 1rem)",
                  lineHeight: 1.75,
                  color: "rgba(255,255,255,0.35)",
                  maxWidth: "480px",
                  opacity: 0,
                }}>
                Protecting identities through cryptographic proof. Real-time ride monitoring,
                tamper-proof emergency alerts, and offline-resilient communication — all without
                storing a single byte of your personal data.
              </p>

              {/* Thin divider — anime.js: .hero-divider */}
              <div
                className="hero-divider"
                style={{
                  width: "60px", height: "2px",
                  background: "linear-gradient(90deg, #7c3aed, #4f46e5)",
                  marginBottom: "1.8rem",
                  transformOrigin: "left",
                  opacity: 0,
                  borderRadius: "999px",
                }} />

              {/* CTA Buttons — anime.js: .hero-cta */}
              <div className="flex flex-row gap-3.5 items-center flex-wrap">

                <Link to="/cab"
                  className="hero-cta btn-cta-violet px-8 py-3.5 font-semibold text-xs tracking-widest uppercase text-white flex items-center gap-2"
                  style={{ opacity: 0 }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  Launch Cab
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>

                <Link to="/wallet"
                  className="hero-cta px-8 py-3.5 rounded-full font-semibold text-xs tracking-widest uppercase border border-white/15 hover:border-white/35 transition-all duration-400 group"
                  style={{
                    color: "rgba(255,255,255,0.5)",
                    background: "rgba(255,255,255,0.04)",
                    backdropFilter: "blur(8px)",
                    opacity: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.95)"
                    e.currentTarget.style.boxShadow = "0 0 24px rgba(255,255,255,0.06)"
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)"
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.5)"
                    e.currentTarget.style.boxShadow = "none"
                    e.currentTarget.style.background = "rgba(255,255,255,0.04)"
                  }}>
                  Open Identity Vault
                </Link>
              </div>

              {/* Stats row — anime.js: .hero-stat */}
              <div className="flex items-center gap-0 mt-9">
                {[
                  { value: "SHA-256", label: "Encryption" },
                  { value: "0 bytes", label: "Data Stored" },
                  { value: "E2E", label: "Client-Side" },
                  { value: "RSA-PSS", label: "Signed Alerts" },
                ].map((s, i) => (
                  <div key={i} className="hero-stat flex flex-col gap-0.5 px-4 first:pl-0" 
                    style={{ 
                      opacity: 0,
                      borderLeft: i === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                    <span className="text-xs font-bold tracking-widest" style={{ color: "rgba(255,255,255,0.65)" }}>{s.value}</span>
                    <span className="text-[9px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.22)" }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Feature pills — anime.js: .hero-pill */}
              <div className="flex flex-wrap gap-2 mt-6">
                {[
                  "Zero-Knowledge Proof",
                  "Geo-Fenced Routes",
                  "Offline Relay",
                  "Tamper-Proof Logs",
                ].map((tag, i) => (
                  <span
                    key={i}
                    className="hero-pill px-3.5 py-1.5 rounded-full text-[9px] font-semibold tracking-[0.15em] uppercase transition-all duration-300 hover:border-[rgba(139,92,246,0.35)]"
                    style={{
                      color: "rgba(139,92,246,0.75)",
                      background: "rgba(139,92,246,0.06)",
                      border: "1px solid rgba(139,92,246,0.15)",
                      backdropFilter: "blur(4px)",
                      opacity: 0,
                    }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator — anime.js: .hero-scroll-indicator */}
        <div
          ref={scrollIndicatorRef}
          className="hero-scroll-indicator absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ zIndex: 50, opacity: 0 }}>
          <span className="text-white/15 text-[9px] font-medium tracking-[0.35em] uppercase">Scroll</span>
          <div className="w-px h-10 overflow-hidden relative">
            <motion.div
              animate={{ y: [-40, 40] }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-x-0 top-0 h-full"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(139,92,246,0.5), transparent)" }} />
          </div>
        </div>
      </section>

      {/* ══════════════════ BELOW FOLD — anime.js section reveal ══════════════════ */}
      <div ref={belowFoldRef} className="relative" style={{ background: "#030305" }}>

        {/* Floating orbs */}
        <div className="bg-orb-1" style={{ top: "10%", left: "-5%", zIndex: 0 }} />
        <div className="bg-orb-2" style={{ top: "50%", right: "-8%", zIndex: 0 }} />

        {/* Tactical overlays */}
        <div className="tactical-gradient-overlay" style={{ position: "absolute" }} />
        <div className="tactical-grid" style={{ position: "absolute" }} />

        {/* Section separator glow */}
        <div className="section-divider absolute top-0 left-0 right-0" />

        {/* Problem section */}
        <section className="anim-section px-8 py-32 max-w-6xl mx-auto relative">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-px bg-gradient-to-r from-[#8b5cf6] to-transparent" />
            <span className="anim-heading text-[#8b5cf6] text-[10px] font-bold tracking-[0.3em] uppercase" style={{ opacity: 0 }}>The Problem</span>
          </div>
          <h2 className="anim-heading text-4xl md:text-5xl font-bold text-white mb-5 leading-tight" style={{ opacity: 0 }}>
            Privacy is broken<br />
            <span className="gradient-text-violet">at the infrastructure level.</span>
          </h2>
          <p className="anim-desc text-white/35 text-base md:text-lg mb-16 max-w-xl leading-relaxed" style={{ opacity: 0 }}>
            Traditional platforms store raw personal data in centralized servers. One breach exposes everyone.
            Your identity shouldn't be a liability.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: Shield, title: "Raw Identity Storage", desc: "Platforms store unencrypted personal data in centralized servers. One server compromise = millions exposed.", accent: "#ef4444" },
              { icon: AlertTriangle, title: "Centralized Data Leaks", desc: "Central points of failure mean one hack compromises entire user bases. No cryptographic verification.", accent: "#f59e0b" },
              { icon: MapPin, title: "Ride-Sharing Safety Gaps", desc: "Vulnerable users face risks with limited real-time route monitoring and no tamper-proof alerting.", accent: "#8b5cf6" },
              { icon: Radio, title: "Emergency Connectivity Gaps", desc: "Internet outages during disasters cut off the very systems meant to save lives. No offline fallback.", accent: "#3b82f6" },
            ].map(({ icon: Icon, title, desc, accent }, i) => (
              <div key={i}
                className="anim-card tactical-card rounded-2xl p-7 group"
                style={{ opacity: 0 }}
              >
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 group-hover:scale-110"
                  style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                  <Icon className="w-5 h-5" style={{ color: accent }} />
                </div>
                <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Stats bar between sections */}
        <section className="anim-section relative">
          <div className="section-divider" />
          <div className="max-w-6xl mx-auto px-8 py-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: "2048-bit", label: "RSA Key Pairs", icon: Lock },
                { value: "300m", label: "Geo-Fence Radius", icon: MapPin },
                { value: "<2min", label: "Auto Escalation", icon: AlertTriangle },
                { value: "100%", label: "Offline Capable", icon: Radio },
              ].map(({ value, label, icon: Icon }, i) => (
                <div key={i} className="anim-card flex flex-col items-center text-center py-6 px-4 rounded-2xl"
                  style={{
                    opacity: 0,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}>
                  <Icon className="w-5 h-5 text-[#8b5cf6] mb-3" />
                  <span className="text-white font-extrabold text-2xl mb-1 tracking-tight">{value}</span>
                  <span className="text-white/25 text-[10px] font-semibold tracking-[0.2em] uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="section-divider" />
        </section>

        {/* Solution section */}
        <section className="anim-section px-8 py-32 relative">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-20">
              <div className="inline-flex items-center gap-3 mb-5">
                <div className="w-8 h-px bg-gradient-to-r from-transparent to-[#8b5cf6]" />
                <span className="anim-heading text-[#8b5cf6] text-[10px] font-bold tracking-[0.3em] uppercase" style={{ opacity: 0 }}>Our Solution</span>
                <div className="w-8 h-px bg-gradient-to-l from-transparent to-[#8b5cf6]" />
              </div>
              <h2 className="anim-heading text-4xl md:text-5xl font-bold text-white mb-4 leading-tight" style={{ opacity: 0 }}>
                Three pillars of<br />
                <span className="gradient-text-violet">privacy-first infrastructure.</span>
              </h2>
              <p className="anim-desc text-white/30 text-base max-w-lg mx-auto leading-relaxed" style={{ opacity: 0 }}>
                Built from the ground up with zero-knowledge principles, real-time monitoring, and cryptographic proof at every layer.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: Lock, to: "/wallet", title: "Cryptographic Identity Vault", desc: "Store only hashes — never raw IDs. Prove identity without exposing data. SHA-256 client-side hashing.", tag: "Zero Knowledge", color: "#8b5cf6" },
                { icon: Car, to: "/cab", title: "GPS Smart Cab Monitoring", desc: "Real-time geo-fencing with 300m corridor. Deviation detection triggers RSA-signed emergency packets.", tag: "Real-Time", color: "#3b82f6" },
                { icon: Radio, to: "/police", title: "Multi-Layer Emergency Relay", desc: "Internet + mesh fallbacks ensure alerts reach authorities. Tamper-proof trace chains for evidence.", tag: "Offline-First", color: "#10b981" },
              ].map(({ icon: Icon, to, title, desc, tag, color }, i) => (
                <div key={i} className="anim-card" style={{ opacity: 0 }}>
                  <Link to={to} className="block tactical-card rounded-2xl p-7 group h-full relative">
                    {/* Top accent line */}
                    <div className="absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
                    
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                        style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
                        <Icon className="w-5.5 h-5.5" style={{ color }} />
                      </div>
                      <span className="text-[9px] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full"
                        style={{ color, background: `${color}12`, border: `1px solid ${color}25` }}>
                        {tag}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold text-base mb-2.5">{title}</h3>
                    <p className="text-white/35 text-sm leading-relaxed mb-6">{desc}</p>
                    <div className="flex items-center gap-2 text-sm font-semibold transition-all duration-300 group-hover:gap-3" style={{ color }}>
                      <span className="text-[11px] tracking-widest uppercase">Explore</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust section */}
        <section className="anim-section px-8 py-20 relative">
          <div className="section-divider mb-16" />
          <div className="max-w-4xl mx-auto text-center">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: CheckCircle2, text: "No Third-Party APIs" },
                { icon: Lock, text: "Client-Side Only" },
                { icon: Shield, text: "Open Source Stack" },
                { icon: Sparkles, text: "Military-Grade Crypto" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="anim-card flex items-center gap-2.5 justify-center py-4 px-3 rounded-xl"
                  style={{ opacity: 0, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <Icon className="w-4 h-4 text-[#10b981] shrink-0" />
                  <span className="text-white/50 text-xs font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="section-divider" />
        <div className="px-8 py-12 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-[#8b5cf6] pulse-dot" />
            <span ref={footerBrandRef} className="text-white/15 text-xs tracking-widest uppercase">Saarthi · Privacy-First Safety</span>
          </div>
          <span className="text-white/15 text-xs tracking-widest uppercase">Built for Hack-A-League</span>
        </div>
      </div>
    </div>
  )
}

