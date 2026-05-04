import { useEffect, useRef } from "react"
import { motion } from "framer-motion"
import * as THREE from "three"

/**
 * Background particle field using Three.js.
 * Renders low-opacity luminous particles drifting slowly — gives depth without distraction.
 */
function TacticalParticles() {
    const canvasRef = useRef<HTMLCanvasElement>(null)

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
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

            const scene = new THREE.Scene()
            const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200)
            camera.position.set(0, 0, 12)

            // ── Particle system ──
            const PARTICLE_COUNT = 400
            const positions = new Float32Array(PARTICLE_COUNT * 3)
            const velocities: number[] = []
            const sizes = new Float32Array(PARTICLE_COUNT)
            const colors = new Float32Array(PARTICLE_COUNT * 3)

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                positions[i * 3] = (Math.random() - 0.5) * 35
                positions[i * 3 + 1] = (Math.random() - 0.5) * 22
                positions[i * 3 + 2] = (Math.random() - 0.5) * 8
                velocities.push(
                    (Math.random() - 0.5) * 0.003,
                    (Math.random() - 0.5) * 0.002,
                    0
                )
                sizes[i] = 0.02 + Math.random() * 0.04

                // Color: mix between violet and blue hues
                const t = Math.random()
                colors[i * 3] = 0.35 + t * 0.15  // R
                colors[i * 3 + 1] = 0.15 + t * 0.25  // G
                colors[i * 3 + 2] = 0.75 + t * 0.25  // B
            }

            const geo = new THREE.BufferGeometry()
            geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
            geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))

            const mat = new THREE.PointsMaterial({
                size: 0.045,
                transparent: true,
                opacity: 0.5,
                sizeAttenuation: true,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })

            scene.add(new THREE.Points(geo, mat))

            // ── Connecting lines for nearby particles (constellation effect) ──
            const lineGeo = new THREE.BufferGeometry()
            const MAX_LINES = 200
            const linePositions = new Float32Array(MAX_LINES * 6)
            lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3))
            const lineMat = new THREE.LineBasicMaterial({
                color: 0x7C3AED,
                transparent: true,
                opacity: 0.06,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            })
            const lines = new THREE.LineSegments(lineGeo, lineMat)
            scene.add(lines)

            const onResize = () => {
                const w = canvas.offsetWidth || window.innerWidth
                const h = canvas.offsetHeight || window.innerHeight
                if (!w || !h) return
                renderer.setSize(w, h)
                camera.aspect = w / h
                camera.updateProjectionMatrix()
            }
            window.addEventListener("resize", onResize)

            let animId: number
            const tick = () => {
                animId = requestAnimationFrame(tick)
                const p = geo.attributes.position.array as Float32Array

                for (let i = 0; i < PARTICLE_COUNT; i++) {
                    p[i * 3] += velocities[i * 3]
                    p[i * 3 + 1] += velocities[i * 3 + 1]
                    if (Math.abs(p[i * 3]) > 18) velocities[i * 3] *= -1
                    if (Math.abs(p[i * 3 + 1]) > 11) velocities[i * 3 + 1] *= -1
                }
                geo.attributes.position.needsUpdate = true

                // Update constellation lines
                let lineIdx = 0
                const lp = lineGeo.attributes.position.array as Float32Array
                const CONNECT_DIST = 3.5

                for (let i = 0; i < PARTICLE_COUNT && lineIdx < MAX_LINES; i++) {
                    for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < MAX_LINES; j++) {
                        const dx = p[i * 3] - p[j * 3]
                        const dy = p[i * 3 + 1] - p[j * 3 + 1]
                        const dz = p[i * 3 + 2] - p[j * 3 + 2]
                        const dist = dx * dx + dy * dy + dz * dz
                        if (dist < CONNECT_DIST * CONNECT_DIST) {
                            lp[lineIdx * 6] = p[i * 3]
                            lp[lineIdx * 6 + 1] = p[i * 3 + 1]
                            lp[lineIdx * 6 + 2] = p[i * 3 + 2]
                            lp[lineIdx * 6 + 3] = p[j * 3]
                            lp[lineIdx * 6 + 4] = p[j * 3 + 1]
                            lp[lineIdx * 6 + 5] = p[j * 3 + 2]
                            lineIdx++
                        }
                    }
                }
                // Zero-out remaining line positions
                for (let k = lineIdx * 6; k < MAX_LINES * 6; k++) lp[k] = 0
                lineGeo.attributes.position.needsUpdate = true
                lineGeo.setDrawRange(0, lineIdx * 2)

                renderer.render(scene, camera)
            }
            tick()

                ; (canvas as HTMLCanvasElement & { _cleanup?: () => void })._cleanup = () => {
                    cancelAnimationFrame(animId)
                    window.removeEventListener("resize", onResize)
                    renderer.dispose()
                    geo.dispose()
                    mat.dispose()
                    lineGeo.dispose()
                    lineMat.dispose()
                }
        }

        const raf = requestAnimationFrame(init)
        return () => {
            cancelAnimationFrame(raf)
            const c = canvas as HTMLCanvasElement & { _cleanup?: () => void }
            c._cleanup?.()
        }
    }, [])

    return (
        <canvas ref={canvasRef} className="tactical-particles-canvas" />
    )
}

/**
 * TacticalLayout — Award-winning page wrapper for premium UI.
 *
 * Provides:
 * - Deep cinematic dark gradient background
 * - Three.js particle constellation field
 * - Floating ambient orbs
 * - Animated gradient overlay
 * - Subtle grid pattern
 * - Film grain noise texture
 * - Light sweep depth effect
 * - Page-enter animation with spring physics
 */
export default function TacticalLayout({
    children,
    showParticles = true,
    className = "",
}: {
    children: React.ReactNode
    showParticles?: boolean
    className?: string
}) {
    return (
        <div className={`min-h-screen relative overflow-x-hidden noise-overlay ${className}`}
            style={{ background: "linear-gradient(145deg, #020205 0%, #0a0a14 20%, #06061a 50%, #050510 80%, #000000 100%)" }}>

            {/* Three.js particles */}
            {showParticles && <TacticalParticles />}

            {/* Floating ambient orbs */}
            <div className="bg-orb-1" style={{ top: "15%", left: "-8%", zIndex: 0 }} />
            <div className="bg-orb-2" style={{ bottom: "20%", right: "-6%", zIndex: 0 }} />

            {/* Animated gradient overlay */}
            <div className="tactical-gradient-overlay" />

            {/* Grid pattern */}
            <div className="tactical-grid" />

            {/* Light sweep */}
            <div className="tactical-light-sweep" />

            {/* Page content with enter animation */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="relative z-10"
            >
                {children}
            </motion.div>
        </div>
    )
}
