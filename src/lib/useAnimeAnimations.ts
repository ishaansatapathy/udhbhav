import { useEffect, useRef, useCallback } from "react"
import { animate, stagger, createTimeline, createScope } from "animejs"

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 *  Saarthi — Premium anime.js v4 Animation System
 *  Award-winning cinematic micro-interactions & page choreography
 * ╚══════════════════════════════════════════════════════════════════╝
 */

/* ================================================================== */
/*  1. useAnimeScope — base scoped hook for anime.js in React         */
/* ================================================================== */
export function useAnimeScope(
    setupFn: (scope: ReturnType<typeof createScope>) => void,
    deps: React.DependencyList = []
) {
    const rootRef = useRef<HTMLDivElement>(null)
    const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)

    useEffect(() => {
        if (!rootRef.current) return
        const scope = createScope({ root: rootRef })
        scopeRef.current = scope
        setupFn(scope)
        return () => scope.revert()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)

    return { rootRef, scopeRef }
}

/* ================================================================== */
/*  2. useHeroEntrance — cinematic hero choreography with 10+ steps   */
/* ================================================================== */
export function useHeroEntrance() {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const scope = createScope({ root: rootRef })
        scope.add(() => {
            const tl = createTimeline({
                defaults: { ease: "out(4)" },
            })

            // 1. Hero title letters fly in from below with blur + scale
            tl.add('.hero-letter', {
                opacity: [0, 1],
                translateY: [100, 0],
                scale: [0.2, 1],
                filter: ["blur(16px)", "blur(0px)"],
                duration: 1000,
                delay: stagger(70, { start: 350 }),
            }, 0)

            // 2. Status badge — clip reveal from left
            tl.add('.hero-badge', {
                opacity: [0, 1],
                translateX: [-40, 0],
                filter: ["blur(6px)", "blur(0px)"],
                duration: 700,
            }, 200)

            // 3. Subtitle typewriter feel
            tl.add('.hero-subtitle', {
                opacity: [0, 1],
                translateY: [20, 0],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 800,
            }, 900)

            // 4. Description paragraph enters with cinematic blur
            tl.add('.hero-desc', {
                opacity: [0, 1],
                translateY: [25, 0],
                filter: ["blur(6px)", "blur(0px)"],
                duration: 800,
            }, 1050)

            // 5. Divider line — width expand from origin-left
            tl.add('.hero-divider', {
                scaleX: [0, 1],
                opacity: [0, 1],
                duration: 800,
                ease: "out(3)",
            }, 1200)

            // 6. CTA buttons spring in with rotation hint
            tl.add('.hero-cta', {
                opacity: [0, 1],
                translateY: [30, 0],
                scale: [0.85, 1],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 700,
                delay: stagger(140),
                ease: "out(3)",
            }, 1400)

            // 7. Stats row — cascade up with stagger
            tl.add('.hero-stat', {
                opacity: [0, 1],
                translateY: [20, 0],
                translateX: [-8, 0],
                duration: 550,
                delay: stagger(80),
            }, 1800)

            // 8. Feature pills — elastic pop-in
            tl.add('.hero-pill', {
                opacity: [0, 1],
                translateX: [-16, 0],
                scale: [0.7, 1],
                filter: ["blur(3px)", "blur(0px)"],
                duration: 500,
                delay: stagger(70),
                ease: "out(4)",
            }, 2100)

            // 9. Scroll indicator — gentle float up
            tl.add('.hero-scroll-indicator', {
                opacity: [0, 0.7],
                translateY: [30, 0],
                duration: 900,
                ease: "out(2)",
            }, 2700)
        })

        return () => scope.revert()
    }, [])

    return rootRef
}

/* ================================================================== */
/*  3. useStaggerCards — scroll-triggered card entrance with blur      */
/* ================================================================== */
export function useStaggerCards(selector: string = ".anim-card") {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const cards = el.querySelectorAll(selector)
        if (cards.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        animate(cards, {
                            opacity: [0, 1],
                            translateY: [70, 0],
                            scale: [0.88, 1],
                            filter: ["blur(8px)", "blur(0px)"],
                            duration: 800,
                            delay: stagger(100, { start: 150 }),
                            ease: "out(4)",
                        })
                        observer.disconnect()
                    }
                })
            },
            { threshold: 0.15 }
        )
        observer.observe(el)

        return () => observer.disconnect()
    }, [selector])

    return rootRef
}

/* ================================================================== */
/*  4. useTextReveal — character-by-character scramble reveal          */
/* ================================================================== */
export function useTextReveal(selector: string = ".anim-text-reveal") {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const targets = el.querySelectorAll(selector)
        if (targets.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        targets.forEach((target) => {
                            const text = target.textContent || ""
                            target.innerHTML = text
                                .split("")
                                .map(
                                    (char) =>
                                        `<span class="anim-char" style="display:inline-block;opacity:0">${char === " " ? "&nbsp;" : char}</span>`
                                )
                                .join("")

                            animate(target.querySelectorAll(".anim-char"), {
                                opacity: [0, 1],
                                translateY: [24, 0],
                                filter: ["blur(3px)", "blur(0px)"],
                                duration: 450,
                                delay: stagger(25),
                                ease: "out(3)",
                            })
                        })
                        observer.disconnect()
                    }
                })
            },
            { threshold: 0.3 }
        )
        observer.observe(el)

        return () => observer.disconnect()
    }, [selector])

    return rootRef
}

/* ================================================================== */
/*  5. useSectionReveal — scroll-triggered heading + card cascade      */
/* ================================================================== */
export function useSectionReveal() {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const sections = el.querySelectorAll(".anim-section")
        if (sections.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const section = entry.target

                        // Heading — cinematic entrance with blur
                        const headings = section.querySelectorAll(".anim-heading")
                        if (headings.length > 0) {
                            animate(headings, {
                                opacity: [0, 1],
                                translateY: [50, 0],
                                filter: ["blur(8px)", "blur(0px)"],
                                duration: 900,
                                delay: stagger(120),
                                ease: "out(4)",
                            })
                        }

                        // Description — soft float up
                        const desc = section.querySelector(".anim-desc")
                        if (desc) {
                            animate(desc, {
                                opacity: [0, 1],
                                translateY: [30, 0],
                                filter: ["blur(4px)", "blur(0px)"],
                                duration: 800,
                                delay: 250,
                                ease: "out(3)",
                            })
                        }

                        // Cards — staggered rise + deblur
                        const cards = section.querySelectorAll(".anim-card")
                        if (cards.length > 0) {
                            animate(cards, {
                                opacity: [0, 1],
                                translateY: [60, 0],
                                scale: [0.92, 1],
                                filter: ["blur(6px)", "blur(0px)"],
                                duration: 750,
                                delay: stagger(90, { start: 350 }),
                                ease: "out(4)",
                            })
                        }

                        observer.unobserve(section)
                    }
                })
            },
            { threshold: 0.1 }
        )
        sections.forEach((s) => observer.observe(s))

        return () => observer.disconnect()
    }, [])

    return rootRef
}

/* ================================================================== */
/*  6. triggerRipple — expanding ripple rings from click point         */
/* ================================================================== */
export function triggerRipple(
    container: HTMLElement,
    x: number,
    y: number,
    color: string = "rgba(139, 92, 246, 0.4)"
) {
    for (let i = 0; i < 4; i++) {
        const ripple = document.createElement("div")
        ripple.style.cssText = `
            position:absolute; left:${x}px; top:${y}px;
            width:0; height:0; border-radius:50%; background:${color};
            transform:translate(-50%,-50%); pointer-events:none; z-index:100;
        `
        container.appendChild(ripple)
        animate(ripple, {
            width: [0, 250],
            height: [0, 250],
            opacity: [0.5, 0],
            duration: 900,
            delay: i * 180,
            ease: "out(3)",
            onComplete: () => ripple.remove(),
        })
    }
}

/* ================================================================== */
/*  7. useCountUp — animate number counting up on scroll              */
/* ================================================================== */
export function useCountUp(
    targetRef: React.RefObject<HTMLElement | null>,
    endValue: number,
    duration: number = 1800,
    prefix: string = "",
    suffix: string = ""
) {
    useEffect(() => {
        const el = targetRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    const obj = { val: 0 }
                    animate(obj, {
                        val: endValue,
                        duration,
                        ease: "out(3)",
                        onUpdate: () => {
                            el.textContent = `${prefix}${Math.round(obj.val)}${suffix}`
                        },
                    })
                    observer.disconnect()
                }
            },
            { threshold: 0.5 }
        )
        observer.observe(el)

        return () => observer.disconnect()
    }, [targetRef, endValue, duration, prefix, suffix])
}

/* ================================================================== */
/*  8. useNavBrandEntrance — stagger brand letters in navbar           */
/* ================================================================== */
export function useNavBrandEntrance() {
    const brandRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = brandRef.current
        if (!el) return

        const scope = createScope({ root: brandRef })
        scope.add(() => {
            animate('.nav-brand-letter', {
                opacity: [0, 1],
                translateY: [-15, 0],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 500,
                delay: stagger(50, { start: 200 }),
                ease: "out(4)",
            })
        })

        return () => scope.revert()
    }, [])

    return brandRef
}

/* ================================================================== */
/*  9. useWalletEntrance — cinematic Wallet page choreography         */
/* ================================================================== */
export function useWalletEntrance() {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const scope = createScope({ root: rootRef })
        scope.add(() => {
            const tl = createTimeline({
                defaults: { ease: "out(4)" },
            })

            // Badge slide in from left with blur
            tl.add('.wallet-badge', {
                opacity: [0, 1],
                translateX: [-30, 0],
                filter: ["blur(6px)", "blur(0px)"],
                duration: 600,
            }, 100)

            // Title words reveal
            tl.add('.wallet-title', {
                opacity: [0, 1],
                translateY: [40, 0],
                filter: ["blur(10px)", "blur(0px)"],
                duration: 800,
            }, 250)

            // Subtitle
            tl.add('.wallet-subtitle', {
                opacity: [0, 1],
                translateY: [20, 0],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 700,
            }, 500)

            // Security badges cascade in
            tl.add('.wallet-sec-badge', {
                opacity: [0, 1],
                translateY: [16, 0],
                scale: [0.8, 1],
                filter: ["blur(3px)", "blur(0px)"],
                duration: 500,
                delay: stagger(80),
            }, 700)

            // Upload zone rises up
            tl.add('.wallet-upload', {
                opacity: [0, 1],
                translateY: [40, 0],
                filter: ["blur(6px)", "blur(0px)"],
                duration: 700,
            }, 900)

            // How-it-works panel slides in from right
            tl.add('.wallet-sidebar', {
                opacity: [0, 1],
                translateX: [30, 0],
                filter: ["blur(6px)", "blur(0px)"],
                duration: 700,
            }, 1000)

            // Sidebar step items stagger in
            tl.add('.wallet-step', {
                opacity: [0, 1],
                translateX: [12, 0],
                duration: 400,
                delay: stagger(70),
            }, 1200)

            // Strength ring
            tl.add('.wallet-strength', {
                opacity: [0, 1],
                scale: [0.8, 1],
                filter: ["blur(8px)", "blur(0px)"],
                duration: 800,
            }, 1100)
        })

        return () => scope.revert()
    }, [])

    return rootRef
}

/* ================================================================== */
/*  10. useProofCardEntrance — stagger proof cards with spring feel    */
/* ================================================================== */
export function useProofCardReveal() {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const cards = el.querySelectorAll('.proof-card')
                        if (cards.length > 0) {
                            animate(cards, {
                                opacity: [0, 1],
                                translateY: [40, 0],
                                scale: [0.9, 1],
                                filter: ["blur(6px)", "blur(0px)"],
                                duration: 700,
                                delay: stagger(80, { start: 100 }),
                                ease: "out(4)",
                            })
                        }
                        observer.disconnect()
                    }
                })
            },
            { threshold: 0.1 }
        )
        observer.observe(el)

        return () => observer.disconnect()
    }, [])

    return rootRef
}

/* ================================================================== */
/*  11. useHashReveal — cinematic hex hash character cascade           */
/* ================================================================== */
export function useHashReveal(hash: string | null, containerRef: React.RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const el = containerRef.current
        if (!el || !hash) return

        const chars = el.querySelectorAll('.hash-char')
        if (chars.length === 0) return

        animate(chars, {
            opacity: [0, 1],
            translateY: [8, 0],
            color: ['#7C3AED', '#c4b5fd'],
            duration: 300,
            delay: stagger(12),
            ease: "out(2)",
        })
    }, [hash, containerRef])
}

/* ================================================================== */
/*  12. useProcessingPulse — looping pulse for active processing      */
/* ================================================================== */
export function useProcessingPulse(isProcessing: boolean) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el || !isProcessing) return

        const scope = createScope({ root: ref })
        scope.add(() => {
            // Fingerprint icon spin
            animate('.proc-icon', {
                rotate: [0, 360],
                duration: 1200,
                loop: true,
                ease: "linear",
            })

            // Progress glow pulse
            animate('.proc-glow', {
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.05, 1],
                duration: 1500,
                loop: true,
                ease: "inOut(2)",
            })
        })

        return () => scope.revert()
    }, [isProcessing])

    return ref
}

/* ================================================================== */
/*  13. useEmergencyEntrance — choreograph emergency page entrance     */
/* ================================================================== */
export function useEmergencyEntrance() {
    const rootRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const scope = createScope({ root: rootRef })
        scope.add(() => {
            const tl = createTimeline({
                defaults: { ease: "out(4)" },
            })

            // Header badge
            tl.add('.emer-badge', {
                opacity: [0, 1],
                translateY: [-20, 0],
                filter: ["blur(6px)", "blur(0px)"],
                duration: 600,
            }, 100)

            // Title
            tl.add('.emer-title', {
                opacity: [0, 1],
                translateY: [30, 0],
                filter: ["blur(8px)", "blur(0px)"],
                duration: 800,
            }, 250)

            // Subtitle
            tl.add('.emer-subtitle', {
                opacity: [0, 1],
                translateY: [15, 0],
                duration: 600,
            }, 500)

            // GPS badge
            tl.add('.emer-gps', {
                opacity: [0, 1],
                scale: [0.85, 1],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 600,
            }, 600)

            // Category selector
            tl.add('.emer-category', {
                opacity: [0, 1],
                translateY: [20, 0],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 600,
            }, 750)

            // SOS button — dramatic entrance
            tl.add('.emer-sos-btn', {
                opacity: [0, 1],
                scale: [0.5, 1],
                filter: ["blur(12px)", "blur(0px)"],
                duration: 900,
                ease: "out(3)",
            }, 900)

            // Bottom panels stagger
            tl.add('.emer-panel', {
                opacity: [0, 1],
                translateY: [24, 0],
                filter: ["blur(4px)", "blur(0px)"],
                duration: 600,
                delay: stagger(120),
            }, 1300)
        })

        return () => scope.revert()
    }, [])

    return rootRef
}

/* ================================================================== */
/*  14. useSOSPulseRings — concentric expanding rings on SOS button   */
/* ================================================================== */
export function useSOSPulseRings(active: boolean) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el || !active) return

        const scope = createScope({ root: ref })
        scope.add(() => {
            // Inner pulse ring
            animate('.sos-ring-inner', {
                scale: [1, 1.2, 1],
                opacity: [0.25, 0.05, 0.25],
                duration: 2200,
                loop: true,
                ease: "inOut(2)",
            })

            // Outer glow ring  
            animate('.sos-ring-outer', {
                scale: [1, 1.35, 1],
                opacity: [0.1, 0.02, 0.1],
                duration: 3000,
                loop: true,
                ease: "inOut(2)",
            })

            // Button subtle breathe
            animate('.sos-btn-core', {
                scale: [1, 1.02, 1],
                duration: 2500,
                loop: true,
                ease: "inOut(2)",
            })
        })

        return () => scope.revert()
    }, [active])

    return ref
}

/* ================================================================== */
/*  15. useTimelineStepReveal — timeline step-by-step anime reveal    */
/* ================================================================== */
export function animateTimelineStep(container: HTMLElement, stepIndex: number) {
    const steps = container.querySelectorAll('.timeline-step')
    const target = steps[stepIndex]
    if (!target) return

    // Dot glow pulse
    const dot = target.querySelector('.step-dot')
    if (dot) {
        animate(dot, {
            scale: [0, 1.3, 1],
            opacity: [0, 1],
            duration: 500,
            ease: "out(3)",
        })
    }

    // Label slide in
    const label = target.querySelector('.step-label')
    if (label) {
        animate(label, {
            opacity: [0, 1],
            translateX: [-12, 0],
            filter: ["blur(3px)", "blur(0px)"],
            duration: 400,
            delay: 100,
            ease: "out(3)",
        })
    }

    // Detail text
    const detail = target.querySelector('.step-detail')
    if (detail) {
        animate(detail, {
            opacity: [0, 1],
            translateY: [6, 0],
            duration: 350,
            delay: 250,
            ease: "out(3)",
        })
    }

    // Connecting line grow
    const line = target.querySelector('.step-line')
    if (line) {
        animate(line, {
            scaleY: [0, 1],
            opacity: [0, 1],
            duration: 400,
            delay: 50,
            ease: "out(2)",
        })
    }
}

/* ================================================================== */
/*  16. useMagneticHover — elements subtly follow cursor on hover     */
/* ================================================================== */
export function useMagneticHover(ref: React.RefObject<HTMLElement | null>, strength: number = 0.3) {
    useEffect(() => {
        const el = ref.current
        if (!el) return

        const onMove = (e: MouseEvent) => {
            const rect = el.getBoundingClientRect()
            const cx = rect.left + rect.width / 2
            const cy = rect.top + rect.height / 2
            const dx = (e.clientX - cx) * strength
            const dy = (e.clientY - cy) * strength

            animate(el, {
                translateX: dx,
                translateY: dy,
                duration: 400,
                ease: "out(2)",
            })
        }

        const onLeave = () => {
            animate(el, {
                translateX: 0,
                translateY: 0,
                duration: 600,
                ease: "out(3)",
            })
        }

        el.addEventListener("mousemove", onMove)
        el.addEventListener("mouseleave", onLeave)
        return () => {
            el.removeEventListener("mousemove", onMove)
            el.removeEventListener("mouseleave", onLeave)
        }
    }, [ref, strength])
}

/* ================================================================== */
/*  17. useFloatingElement — subtle idle float/bob animation           */
/* ================================================================== */
export function useFloatingElement(ref: React.RefObject<HTMLElement | null>, amplitude: number = 8) {
    useEffect(() => {
        const el = ref.current
        if (!el) return

        const anim = animate(el, {
            translateY: [-amplitude, amplitude],
            duration: 3000,
            loop: true,
            alternate: true,
            ease: "inOut(2)",
        })

        return () => { anim.pause() }
    }, [ref, amplitude])
}

/* ================================================================== */
/*  18. useGlitchText — periodic glitch/scramble effect on text       */
/* ================================================================== */
export function useGlitchText(ref: React.RefObject<HTMLElement | null>, intervalMs: number = 4000) {
    useEffect(() => {
        const el = ref.current
        if (!el) return

        const original = el.textContent || ""
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123456789$#@&"

        const glitch = () => {
            let frame = 0
            const maxFrames = 8
            const id = setInterval(() => {
                if (frame >= maxFrames) {
                    el.textContent = original
                    clearInterval(id)
                    return
                }
                el.textContent = original
                    .split("")
                    .map((ch, i) =>
                        Math.random() < 0.3 && i < original.length
                            ? chars[Math.floor(Math.random() * chars.length)]
                            : ch
                    )
                    .join("")
                frame++
            }, 40)
        }

        const interval = setInterval(glitch, intervalMs)
        return () => clearInterval(interval)
    }, [ref, intervalMs])
}

/* ================================================================== */
/*  19. triggerSuccessFlash — bright flash + scale bounce on success   */
/* ================================================================== */
export function triggerSuccessFlash(el: HTMLElement) {
    animate(el, {
        scale: [1, 1.05, 0.97, 1],
        filter: ["brightness(1)", "brightness(1.4)", "brightness(1)"],
        duration: 600,
        ease: "out(3)",
    })
}

/* ================================================================== */
/*  20. useScrollParallax — elements move at different speeds          */
/* ================================================================== */
export function useScrollParallax(
    ref: React.RefObject<HTMLElement | null>,
    speed: number = 0.15
) {
    useEffect(() => {
        const el = ref.current
        if (!el) return

        let ticking = false
        const onScroll = () => {
            if (ticking) return
            ticking = true
            requestAnimationFrame(() => {
                const rect = el.getBoundingClientRect()
                const viewH = window.innerHeight
                const center = rect.top + rect.height / 2
                const offset = (center - viewH / 2) * speed
                el.style.transform = `translateY(${offset}px)`
                ticking = false
            })
        }

        window.addEventListener("scroll", onScroll, { passive: true })
        return () => window.removeEventListener("scroll", onScroll)
    }, [ref, speed])
}

/* ================================================================== */
/*  21. useStrengthRingAnime — animate SVG circle stroke              */
/* ================================================================== */
export function useStrengthRingAnime(
    circleRef: React.RefObject<SVGCircleElement | null>,
    percentage: number,
    radius: number = 40
) {
    useEffect(() => {
        const circle = circleRef.current
        if (!circle) return

        const circumference = 2 * Math.PI * radius
        const target = circumference * (1 - percentage / 100)

        animate(circle, {
            strokeDashoffset: [circumference, target],
            duration: 1200,
            ease: "out(3)",
        })
    }, [circleRef, percentage, radius])
}

/* ================================================================== */
/*  22. useDragZonePulse — subtle pulse when drag zone is waiting      */
/* ================================================================== */
export function useDragZonePulse(ref: React.RefObject<HTMLElement | null>, active: boolean) {
    useEffect(() => {
        const el = ref.current
        if (!el || !active) return

        const anim = animate(el, {
            borderColor: [
                "rgba(124,58,237,0.15)",
                "rgba(124,58,237,0.5)",
                "rgba(124,58,237,0.15)",
            ],
            duration: 2000,
            loop: true,
            ease: "inOut(2)",
        })

        return () => { anim.pause() }
    }, [ref, active])
}

/* ================================================================== */
/*  23. animateNewProofCard — entrance for a newly added proof card    */
/* ================================================================== */
export function animateNewProofCard(el: HTMLElement) {
    animate(el, {
        opacity: [0, 1],
        translateY: [30, 0],
        scale: [0.85, 1],
        filter: ["blur(8px)", "blur(0px)"],
        duration: 700,
        ease: "out(4)",
    })
}

/* ================================================================== */
/*  24. useHoldProgressAnime — animate hold-to-trigger progress bar   */
/* ================================================================== */
export function useHoldProgressAnime(
    barRef: React.RefObject<HTMLElement | null>,
    progress: number
) {
    const prevRef = useRef(0)

    useEffect(() => {
        const el = barRef.current
        if (!el) return

        // Animate width smoothly
        animate(el, {
            width: [`${prevRef.current}%`, `${progress}%`],
            duration: 100,
            ease: "linear",
        })

        // Color shift based on progress
        if (progress > 70) {
            el.style.background = "#ef4444"
            el.style.boxShadow = "0 0 12px rgba(239,68,68,0.4)"
        } else if (progress > 0) {
            el.style.background = "#f59e0b"
            el.style.boxShadow = "0 0 8px rgba(245,158,11,0.3)"
        }

        prevRef.current = progress
    }, [barRef, progress])
}

/* ================================================================== */
/*  25. triggerSOSShockwave — big shockwave when SOS fires            */
/* ================================================================== */
export function triggerSOSShockwave(container: HTMLElement) {
    for (let i = 0; i < 3; i++) {
        const ring = document.createElement("div")
        ring.style.cssText = `
            position:absolute; inset:0; border-radius:50%;
            border:2px solid rgba(239,68,68,0.4);
            pointer-events:none; z-index:10;
        `
        container.appendChild(ring)
        animate(ring, {
            scale: [1, 2.5],
            opacity: [0.6, 0],
            duration: 1000,
            delay: i * 200,
            ease: "out(3)",
            onComplete: () => ring.remove(),
        })
    }
}

/* ================================================================== */
/*  26. usePageTransition — cinematic page entrance                    */
/* ================================================================== */
export function usePageTransition() {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return

        animate(el, {
            opacity: [0, 1],
            translateY: [20, 0],
            filter: ["blur(6px)", "blur(0px)"],
            duration: 600,
            ease: "out(3)",
        })
    }, [])

    return ref
}

/* ================================================================== */
/*  27. useStatsCountUp — batch count-up for multiple stat elements   */
/* ================================================================== */
export function useStatsCountUp(rootRef: React.RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const el = rootRef.current
        if (!el) return

        const statEls = el.querySelectorAll<HTMLElement>('[data-count-to]')
        if (statEls.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    statEls.forEach((stat) => {
                        const end = parseFloat(stat.dataset.countTo || "0")
                        const pre = stat.dataset.countPrefix || ""
                        const suf = stat.dataset.countSuffix || ""
                        const obj = { val: 0 }
                        animate(obj, {
                            val: end,
                            duration: 2000,
                            ease: "out(3)",
                            onUpdate: () => {
                                stat.textContent = `${pre}${Math.round(obj.val)}${suf}`
                            },
                        })
                    })
                    observer.disconnect()
                }
            },
            { threshold: 0.3 }
        )
        observer.observe(el)

        return () => observer.disconnect()
    }, [rootRef])
}

/* ================================================================== */
/*  28. useCardHoverGlow — anime.js powered hover glow on cards       */
/* ================================================================== */
export function useCardHoverGlow(ref: React.RefObject<HTMLElement | null>) {
    useEffect(() => {
        const el = ref.current
        if (!el) return

        const onEnter = () => {
            animate(el, {
                boxShadow: ["0 0 0 rgba(124,58,237,0)", "0 0 30px rgba(124,58,237,0.15)"],
                borderColor: ["rgba(255,255,255,0.08)", "rgba(124,58,237,0.4)"],
                duration: 300,
                ease: "out(2)",
            })
        }

        const onLeave = () => {
            animate(el, {
                boxShadow: ["0 0 30px rgba(124,58,237,0.15)", "0 0 0 rgba(124,58,237,0)"],
                borderColor: ["rgba(124,58,237,0.4)", "rgba(255,255,255,0.08)"],
                duration: 400,
                ease: "out(2)",
            })
        }

        el.addEventListener("mouseenter", onEnter)
        el.addEventListener("mouseleave", onLeave)
        return () => {
            el.removeEventListener("mouseenter", onEnter)
            el.removeEventListener("mouseleave", onLeave)
        }
    }, [ref])
}
