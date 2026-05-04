import { useRef, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link } from "react-router-dom"
import * as THREE from "three"
import { Lock, Car, Radio, Shield, MapPin, AlertTriangle } from "lucide-react"
import { useInView } from "framer-motion"

// ── Below-fold section helper ───────────────────────────────────────────────
const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } }

function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <motion.section ref={ref} id={id}
      initial="initial" animate={inView ? "animate" : "initial"}
      variants={{ initial: {}, animate: { transition: { staggerChildren: 0.1 } } }}
      className={className}>
      {children}
    </motion.section>
  )
}

// ── Three.js – particles only (rings are now SVG) ───────────────────────────
function useThreeScene(canvasRef: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const W = canvas.offsetWidth
    const H = canvas.offsetHeight

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200)
    camera.position.set(0, 0, 8)

    // ── Particle system ────────────────────────────────────────────────────
    const PARTICLE_COUNT = 1800
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const velocities: number[] = []

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      const r     = 3 + Math.random() * 12
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6
      velocities.push(
        (Math.random() - 0.5) * 0.0012,
        (Math.random() - 0.5) * 0.0012,
        (Math.random() - 0.5) * 0.0006,
      )
    }

    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, transparent: true, opacity: 0.55, sizeAttenuation: true })
    )
    scene.add(particles)

    // ── Mouse parallax ────────────────────────────────────────────────────
    let mouseX = 0, mouseY = 0
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth  - 0.5) * 2
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener("mousemove", onMouse)

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    window.addEventListener("resize", onResize)

    // ── Animation loop ────────────────────────────────────────────────────
    let animId: number

    const tick = () => {
      animId = requestAnimationFrame(tick)

      // Particle drift
      const pos = pGeo.attributes.position.array as Float32Array
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3]     += velocities[i * 3]
        pos[i * 3 + 1] += velocities[i * 3 + 1]
        pos[i * 3 + 2] += velocities[i * 3 + 2]
        if (Math.abs(pos[i * 3])     > 15) velocities[i * 3]     *= -1
        if (Math.abs(pos[i * 3 + 1]) > 15) velocities[i * 3 + 1] *= -1
        if (Math.abs(pos[i * 3 + 2]) > 4)  velocities[i * 3 + 2] *= -1
      }
      pGeo.attributes.position.needsUpdate = true

      // Camera parallax from mouse (smooth lerp)
      camera.position.x += (mouseX * 0.6 - camera.position.x) * 0.04
      camera.position.y += (-mouseY * 0.4 - camera.position.y) * 0.04
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("mousemove", onMouse)
      window.removeEventListener("resize", onResize)
      renderer.dispose()
    }
  }, [canvasRef])
}

// ── SVG Radar rings (drawn above the video) ─────────────────────────────────
const RADAR_SIZE = 520   // SVG canvas size (px)
const RADAR_R    = 260   // half (viewBox origin at centre)

// Slowed to sync visually with chakra at 0.6× playback
const ringDefs = [
  { r: 230, op: 0.48, dur: "38s",  dir: "spinCW"  },
  { r: 178, op: 0.38, dur: "30s",  dir: "spinCCW" },
  { r: 128, op: 0.58, dur: "22s",  dir: "spinCW"  },
  { r: 78,  op: 0.32, dur: "16s",  dir: "spinCCW" },
  { r: 38,  op: 0.28, dur: "12s",  dir: "spinCW"  },
]

function RadarRings() {
  return (
    <svg
      width={RADAR_SIZE} height={RADAR_SIZE}
      viewBox={`${-RADAR_R} ${-RADAR_R} ${RADAR_SIZE} ${RADAR_SIZE}`}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>

      {/* Concentric rings */}
      {ringDefs.map(({ r, op, dur, dir }, i) => (
        <circle key={i} cx={0} cy={0} r={r}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth={i === 2 ? 1.4 : 0.75}
          strokeOpacity={op}
          style={{ animation: `${dir} ${dur} linear infinite`, transformOrigin: "0 0" }} />
      ))}

      {/* 16 spokes – same CW direction as chakra spin */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2
        return (
          <line key={i}
            x1={38  * Math.cos(a)} y1={38  * Math.sin(a)}
            x2={228 * Math.cos(a)} y2={228 * Math.sin(a)}
            stroke="#8b5cf6" strokeOpacity={0.16} strokeWidth={0.55}
            style={{ animation: `spinCW 38s linear infinite`, transformOrigin: "0 0" }} />
        )
      })}

      {/* 32 outer tick marks */}
      {Array.from({ length: 32 }, (_, i) => {
        const a  = (i / 32) * Math.PI * 2
        const r0 = 236
        const r1 = i % 4 === 0 ? 250 : 242
        return (
          <line key={i}
            x1={r0 * Math.cos(a)} y1={r0 * Math.sin(a)}
            x2={r1 * Math.cos(a)} y2={r1 * Math.sin(a)}
            stroke="#a78bfa" strokeOpacity={i % 4 === 0 ? 0.55 : 0.20} strokeWidth={0.8}
            style={{ animation: `spinCCW 30s linear infinite`, transformOrigin: "0 0" }} />
        )
      })}

      {/* Sweep line – faint white, CW at same cadence as outer ring */}
      <defs>
        <linearGradient id="sweepGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(255,255,255,0)"   />
          <stop offset="40%"  stopColor="rgba(255,255,255,0.12)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.28)" />
        </linearGradient>
      </defs>
      <line x1={0} y1={0} x2={0} y2={-226}
        stroke="url(#sweepGrad)" strokeWidth={1.2}
        style={{ animation: `spinCW 38s linear infinite`, transformOrigin: "0 0" }} />

      {/* Hub dot */}
      <circle cx={0} cy={0} r={4} fill="#c4b5fd" fillOpacity={0.85} />
    </svg>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function HomePage() {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const videoRef     = useRef<HTMLVideoElement>(null)
  const contentRef   = useRef<HTMLDivElement>(null)
  const [navScrolled, setNavScrolled] = useState(false)
  const [mounted, setMounted]         = useState(false)
  const [mouse, setMouse]             = useState({ x: 0, y: 0 })

  useThreeScene(canvasRef)

  // Slow video to 0.6× on mount
  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = 0.6
  }, [])

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setNavScrolled(window.scrollY > 60)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth  - 0.5),
        y: (e.clientY / window.innerHeight - 0.5),
      })
    }
    window.addEventListener("mousemove", onMouse)
    return () => window.removeEventListener("mousemove", onMouse)
  }, [])

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ background: "#000" }}>

      {/* ── Navbar ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between transition-all duration-500 ${navScrolled ? "bg-black/60 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
        <Link to="/" className="text-white font-bold text-base tracking-[0.15em] uppercase">Saarthi</Link>
        <nav className="flex items-center gap-10">
          {[
            { to: "/wallet", label: "Wallet" },
            { to: "/cab",    label: "Cab"    },
            { to: "/police", label: "Police" },
          ].map(({ to, label }) => (
            <Link key={to} to={to}
              className="text-white/40 hover:text-white text-xs font-medium tracking-widest uppercase transition-colors duration-300">
              {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative h-screen w-full overflow-hidden flex items-center justify-center">

        {/* ── L1: Grid background ── */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5,
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.05) 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
        }} />

        {/* ── L2: Particles (Three.js) ── */}
        <canvas ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 10, opacity: 0.30 }} />

        {/* ── L2.5: Energy core radial glow (behind video) ── */}
        <div className="absolute pointer-events-none"
          style={{
            zIndex: 18,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "clamp(280px, 42vmin, 480px)",
            height: "clamp(280px, 42vmin, 480px)",
            borderRadius: "50%",
            background: "radial-gradient(circle at center, rgba(139,92,246,0.40) 0%, rgba(139,92,246,0.20) 30%, transparent 65%)",
            animation: "coreGlow 3.5s ease-in-out infinite",
          }} />

        {/* ── L3: Chakra video – circular energy core ── */}
        <div className="absolute pointer-events-none"
          style={{
            zIndex: 20,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "clamp(260px, 38vmin, 440px)",
            height: "clamp(260px, 38vmin, 440px)",
            borderRadius: "50%",
            overflow: "hidden",
          }}>
          <video
            ref={videoRef}
            src="/chakra.mp4"
            autoPlay loop muted playsInline
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              filter: "grayscale(100%) brightness(65%) contrast(135%) blur(1.5px)",
              opacity: 0.55,
              mixBlendMode: "screen",
            }} />
        </div>

        {/* ── L3.5: Focal point – sharp bright inner circle ── */}
        <div className="absolute pointer-events-none"
          style={{
            zIndex: 25,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: "120px", height: "120px",
            borderRadius: "50%",
            background: "radial-gradient(circle at center, rgba(255,255,255,0.12) 0%, rgba(200,180,255,0.06) 50%, transparent 80%)",
            animation: "focalPulse 3.5s ease-in-out infinite",
          }} />

        {/* ── L4: SVG Radar rings (centred, above video) ── */}
        <div className="absolute pointer-events-none"
          style={{
            zIndex: 30,
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: `${RADAR_SIZE}px`, height: `${RADAR_SIZE}px`,
          }}>
          <RadarRings />
        </div>

        {/* ── L5a: Radial violet glow (pulsing, synced to chakra) ── */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 40,
            background: "radial-gradient(ellipse 55% 50% at 50% 50%, rgba(139,92,246,0.22) 0%, rgba(139,92,246,0.05) 50%, transparent 70%)",
            animation: "chakraPulse 5s ease-in-out infinite",
          }} />

        {/* ── L5b: Soft vignette ── */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            zIndex: 41,
            background: "radial-gradient(ellipse 110% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.80) 100%)",
          }} />

        {/* ── L6: Text content ── */}
        <AnimatePresence>
          {mounted && (
            <motion.div
              ref={contentRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="relative flex flex-col items-center text-center select-none"
              style={{
                zIndex: 50,
                transform: `translate(${mouse.x * -12}px, ${mouse.y * -8}px)`,
                transition: "transform 0.18s ease-out",
              }}>

              {/* Pre-label */}
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
                className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#8b5cf6]/30 bg-[#8b5cf6]/8 text-[#a78bfa] text-[10px] font-bold tracking-[0.2em] uppercase">
                <span className="w-1 h-1 rounded-full bg-[#8b5cf6] animate-pulse" />
                Privacy-First Safety Infrastructure
              </motion.div>

              {/* Main heading */}
              <motion.h1
                initial={{ opacity: 0, y: 30, filter: "blur(14px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.5, duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                className="font-black uppercase leading-none mb-4"
                style={{
                  fontSize: "clamp(2.8rem, 9vw, 6.8rem)",
                  letterSpacing: "0.30em",
                  background: "linear-gradient(175deg, #ffffff 25%, rgba(210,205,230,0.60) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: [
                    "drop-shadow(0 0 20px rgba(255,255,255,0.15))",
                    "drop-shadow(0 0 32px rgba(139,92,246,0.40))",
                  ].join(" "),
                }}>
                Saarthi
              </motion.h1>

              {/* Subheading */}
              <motion.p
                initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }}
                className="text-white/32 font-light uppercase mb-10"
                style={{ fontSize: "clamp(0.6rem, 1.3vw, 0.8rem)", letterSpacing: "0.26em" }}>
                Cryptographic Identity &nbsp;·&nbsp; Smart Geo-Fencing &nbsp;·&nbsp; Emergency Protection
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.15, duration: 0.7 }}
                className="flex flex-col sm:flex-row gap-3.5 items-center">

                <Link to="/cab"
                  className="group relative overflow-hidden px-8 py-3.5 rounded-full font-semibold text-sm tracking-widest uppercase text-white transition-all duration-300"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 0 28px rgba(124,58,237,0.50)" }}>
                  <span className="relative z-10">Launch Cab</span>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(135deg, #8b5cf6, #6366f1)" }} />
                </Link>

                <Link to="/wallet"
                  className="group px-8 py-3.5 rounded-full font-semibold text-sm tracking-widest uppercase text-white/55 hover:text-white border border-white/12 hover:border-[#8b5cf6]/60 transition-all duration-300"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 20px rgba(139,92,246,0.25)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                  Open Identity Vault
                </Link>
              </motion.div>

              {/* Stats row */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.55, duration: 0.8 }}
                className="flex items-center gap-8 mt-12">
                {[
                  { value: "SHA-256", label: "Encryption" },
                  { value: "0ms",     label: "Data Stored" },
                  { value: "E2E",     label: "Client-Side" },
                ].map(stat => (
                  <div key={stat.label} className="flex flex-col items-center gap-0.5">
                    <span className="text-white/65 text-xs font-bold tracking-widest">{stat.value}</span>
                    <span className="text-white/20 text-[9px] tracking-[0.2em] uppercase">{stat.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2.5"
          style={{ zIndex: 50 }}>
          <span className="text-white/18 text-[9px] font-medium tracking-[0.3em] uppercase">Scroll</span>
          <div className="w-px h-10 overflow-hidden relative">
            <motion.div
              animate={{ y: [-40, 40] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
              className="absolute inset-x-0 top-0 h-full"
              style={{ background: "linear-gradient(to bottom, transparent, #8b5cf6, transparent)" }} />
          </div>
        </motion.div>
      </section>

      {/* ══════════════════ BELOW FOLD ══════════════════ */}
      <div className="relative" style={{ background: "#030305" }}>

        {/* Section separator glow */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.3), transparent)" }} />

        {/* Problem */}
        <Section id="about" className="px-8 py-28 max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-4">
            <div className="w-4 h-px bg-[#8b5cf6]" />
            <span className="text-[#8b5cf6] text-[10px] font-bold tracking-[0.3em] uppercase">The Problem</span>
          </motion.div>
          <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-white mb-4 leading-snug">
            Privacy is broken<br />at the infrastructure level.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-white/35 text-base mb-14 max-w-xl leading-relaxed">
            Traditional platforms store raw personal data in centralized servers. One breach exposes everyone.
          </motion.p>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { icon: Shield,        title: "Raw Identity Storage",        desc: "Platforms store unencrypted personal data in centralized servers." },
              { icon: AlertTriangle, title: "Centralized Data Leaks",      desc: "Central points of failure mean one hack compromises entire user bases." },
              { icon: MapPin,        title: "Ride-Sharing Safety Gaps",    desc: "Vulnerable users face risks with limited real-time route monitoring." },
              { icon: Radio,         title: "Emergency Connectivity Gaps", desc: "Internet outages during disasters cut off the very systems meant to save lives." },
            ].map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={i} variants={fadeUp}
                className="rounded-2xl p-6 border border-white/6 hover:border-[#8b5cf6]/30 transition-all duration-300 group"
                style={{ background: "rgba(255,255,255,0.025)" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 24px rgba(139,92,246,0.1)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}>
                  <Icon className="w-4.5 h-4.5 text-[#8b5cf6]" />
                </div>
                <h3 className="text-white font-semibold text-sm mb-1.5">{title}</h3>
                <p className="text-white/35 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* Solution */}
        <Section id="architecture" className="px-8 py-28">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 mb-4">
                <div className="w-4 h-px bg-[#8b5cf6]" />
                <span className="text-[#8b5cf6] text-[10px] font-bold tracking-[0.3em] uppercase">Our Solution</span>
                <div className="w-4 h-px bg-[#8b5cf6]" />
              </motion.div>
              <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-white mb-3">
                Three pillars of<br />privacy-first infrastructure.
              </motion.h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { id: "identity", icon: Lock,  to: "/wallet", title: "Cryptographic Identity Vault", desc: "Store only hashes — never raw IDs. Prove identity without exposing data." },
                { id: "cab",      icon: Car,   to: "/cab",    title: "GPS-Based Smart Cab Monitoring", desc: "Real-time geo-fencing and deviation detection for ride safety." },
                { id: "police",   icon: Radio, to: "/police", title: "Multi-Layer Emergency Relay", desc: "Internet + mesh fallbacks so alerts get through when it matters most." },
              ].map(({ icon: Icon, to, title, desc }, i) => (
                <motion.div key={i} variants={fadeUp}>
                  <Link to={to} className="block rounded-2xl p-6 border border-white/6 hover:border-[#8b5cf6]/40 transition-all duration-300 group h-full"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 32px rgba(139,92,246,0.12)", e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = "none", e.currentTarget.style.transform = "none")}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)" }}>
                      <Icon className="w-5 h-5 text-[#8b5cf6]" />
                    </div>
                    <h3 className="text-white font-semibold text-sm mb-2">{title}</h3>
                    <p className="text-white/35 text-sm leading-relaxed mb-4">{desc}</p>
                    <span className="text-[#8b5cf6]/60 text-[10px] font-bold tracking-widest uppercase group-hover:text-[#8b5cf6] transition-colors">
                      Explore →
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* Footer line */}
        <div className="px-8 py-10 border-t border-white/5 flex items-center justify-between max-w-5xl mx-auto">
          <span className="text-white/15 text-xs tracking-widest uppercase">Saarthi · Privacy-First Safety</span>
          <span className="text-white/15 text-xs tracking-widest uppercase">Built for Hack-A-League</span>
        </div>
      </div>
    </div>
  )
}
