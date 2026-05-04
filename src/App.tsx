import { useRef, useEffect, useState } from "react"
import { motion, useInView, useScroll, useTransform } from "framer-motion"
import gsap from "gsap"
import {
  Lock,
  Car,
  Radio,
  Shield,
  MapPin,
  AlertTriangle,
} from "lucide-react"

const fadeUp = { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 } }

function Section({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <motion.section
      ref={ref}
      id={id}
      initial="initial"
      animate={inView ? "animate" : "initial"}
      variants={{ initial: {}, animate: { transition: { staggerChildren: 0.1 } } }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

export default function App() {
  const heroRef = useRef<HTMLDivElement>(null)
  const headlineRef = useRef<HTMLHeadingElement>(null)
  const paraRef = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress, scrollY } = useScroll()
  const glowOpacity = useTransform(scrollYProgress, [0, 0.3], [0.5, 0])
  const [navScrolled, setNavScrolled] = useState(false)

  useEffect(() => {
    const unsub = scrollY.on("change", (v) => setNavScrolled(v > 60))
    return () => unsub()
  }, [scrollY])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } })
      tl.fromTo(
        headlineRef.current,
        { opacity: 0, y: 32 },
        { opacity: 1, y: 0, duration: 0.8 }
      ).fromTo(
        paraRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 },
        "-=0.4"
      )
    }, heroRef)
    return () => ctx.revert()
  }, [])

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Navbar - fixed, transparent, backdrop blur on scroll */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between transition-all duration-300 ${
          navScrolled ? "bg-[#0f0e0d]/85 backdrop-blur-xl" : "bg-transparent"
        }`}
      >
        <span className="text-[#e8e4e0] font-bold text-lg tracking-tight">TrustLayer</span>
        <nav className="flex items-center gap-8">
          <a href="#wallet" className="text-[#a8a29e] hover:text-[#e8e4e0] text-sm font-medium transition-colors">Wallet</a>
          <a href="#cab" className="text-[#a8a29e] hover:text-[#e8e4e0] text-sm font-medium transition-colors">Cab</a>
          <a href="#police" className="text-[#a8a29e] hover:text-[#e8e4e0] text-sm font-medium transition-colors">Police</a>
        </nav>
      </header>

      {/* Hero - 100vh, centered */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 pb-24 overflow-hidden"
      >
        {/* Background - SVG + warm overlay */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: "url('/background-4k-BqzvgkMx%20(2).svg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "fixed",
          }}
        />
        <div className="absolute inset-0 -z-[9] bg-black/50" />
        <div
          className="absolute inset-0 -z-[8] opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
          }}
        />

        {/* Warm gradient blobs - match background */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 18, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/3 w-[400px] h-[400px] -z-[8] rounded-full bg-[#564f4d]/25 blur-[120px] pointer-events-none"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 25, 0], scale: [1, 1.06, 1] }}
          transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
          className="absolute bottom-1/3 right-1/3 w-[350px] h-[350px] -z-[8] rounded-full bg-[#2f2523]/35 blur-[120px] pointer-events-none"
        />
        <motion.div
          style={{ opacity: glowOpacity }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] -z-[8] rounded-full bg-[#e1d9d0]/10 blur-[140px] pointer-events-none"
        />

        {/* Content - max 1200px, centered */}
        <div className="text-center max-w-[1200px] mx-auto relative z-10">
          <h1
            ref={headlineRef}
            className="text-[clamp(3rem,6vw,5rem)] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#e8e4e0] mb-6"
          >
            Your digital safety,{" "}
            <span
              className="bg-gradient-to-r from-[#e1d9d0] to-[#a8a29e] bg-clip-text text-transparent"
            >
              redefined
            </span>
          </h1>
          <p
            ref={paraRef}
            className="text-[#a8a29e] text-base md:text-lg font-medium max-w-[600px] mx-auto leading-relaxed"
          >
            Cryptographic identity. Smart geo-fencing. Resilient emergency protection—built for trust without compromise.
          </p>
        </div>

        {/* Scroll */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[#a8a29e]/80 text-xs tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-px h-6 bg-gradient-to-b from-[#e1d9d0]/50 to-transparent"
          />
        </motion.div>
      </section>

      {/* Rest of page - background for sections below hero */}
      <div className="relative">
        <div
          className="fixed inset-0 -z-10"
          style={{
            backgroundImage: "url('/background-4k-BqzvgkMx%20(2).svg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "fixed",
          }}
        />
        <div className="fixed inset-0 -z-[9] bg-black/55" />
        <div
          className="fixed inset-0 -z-[8] opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

      {/* Problem */}
      <Section id="about" className="px-6 py-24 max-w-5xl mx-auto">
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-[#e8e4e0] mb-4">
          The Problem
        </motion.h2>
        <motion.p variants={fadeUp} className="text-[#a8a29e] text-lg mb-12 max-w-2xl">
          Traditional platforms store raw personal data. Saarthi uses cryptographic proof instead—with intelligent route monitoring and secure emergency escalation, we enable safer rides and stronger digital trust without compromising privacy.
        </motion.p>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { icon: Shield, title: "Raw Identity Storage", desc: "Platforms store unencrypted personal data in centralized servers—a single breach exposes millions." },
            { icon: AlertTriangle, title: "Centralized Data Leaks", desc: "Central points of failure mean one hack compromises entire user bases." },
            { icon: MapPin, title: "Ride-Sharing Safety Gaps", desc: "Women and vulnerable users face risks with limited real-time monitoring and no crypto-backed accountability." },
            { icon: Radio, title: "Emergency Connectivity Failures", desc: "Internet outages during disasters cut off the very systems meant to save lives." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="rounded-xl border border-[rgba(86,79,77,0.5)] bg-[rgba(47,37,35,0.6)] backdrop-blur-xl p-6 hover:bg-[rgba(47,37,35,0.75)] hover:border-[#e1d9d0]/30 transition-all duration-300"
            >
              <Icon className="w-8 h-8 text-[#e1d9d0] mb-4" />
              <h3 className="text-lg font-semibold text-[#e8e4e0] mb-2">{title}</h3>
              <p className="text-[#a8a29e] text-sm">{desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Solution */}
      <Section id="architecture" className="px-6 py-24 bg-gradient-to-b from-transparent via-[rgba(47,37,35,0.15)] to-transparent">
        <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-bold text-[#e8e4e0] mb-4 text-center">
          Our Solution
        </motion.h2>
        <motion.p variants={fadeUp} className="text-[#a8a29e] text-lg mb-16 text-center max-w-2xl mx-auto">
          Three pillars of privacy-first infrastructure.
        </motion.p>
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {[
            { id: "wallet", icon: Lock, title: "Cryptographic Identity Vault", desc: "Store only hashes—never raw IDs. Prove identity without exposing data." },
            { id: "cab", icon: Car, title: "GPS-Based Smart Cab Monitoring", desc: "Real-time geo-fencing and deviation detection for ride safety." },
            { id: "police", icon: Radio, title: "Multi-Layer Emergency Relay", desc: "Internet + SMS + mesh fallbacks so alerts get through when it matters." },
          ].map(({ id, icon: Icon, title, desc }, i) => (
            <motion.div
              key={i}
              id={id}
              variants={fadeUp}
              className="rounded-xl border border-[rgba(86,79,77,0.5)] bg-[rgba(47,37,35,0.6)] backdrop-blur-xl p-6 hover:scale-[1.02] hover:border-[#e1d9d0]/40 hover:shadow-xl hover:shadow-stone-900/20 transition-all duration-300"
            >
              <Icon className="w-10 h-10 text-[#e1d9d0] mb-4" />
              <h3 className="text-lg font-semibold text-[#e8e4e0] mb-2">{title}</h3>
              <p className="text-[#a8a29e] text-sm">{desc}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      </div>
    </div>
  )
}
