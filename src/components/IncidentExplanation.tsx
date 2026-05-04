/**
 * IncidentExplanation — Displays AI-style incident analysis text
 * with a typing animation effect.
 */

import { useEffect, useState, useRef } from "react"
import { Cpu } from "lucide-react"

interface Props {
  text: string
  zoneAlert: string | null
}

export default function IncidentExplanation({ text, zoneAlert }: Props) {
  const [displayText, setDisplayText] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const prevTextRef = useRef("")

  // Typing animation effect when text changes
  useEffect(() => {
    if (text === prevTextRef.current) return
    prevTextRef.current = text

    if (!text) {
      setDisplayText("")
      setIsTyping(false)
      return
    }

    setIsTyping(true)
    setDisplayText("")

    let idx = 0
    const interval = setInterval(() => {
      idx++
      setDisplayText(text.slice(0, idx))
      if (idx >= text.length) {
        clearInterval(interval)
        setIsTyping(false)
      }
    }, 18)

    return () => clearInterval(interval)
  }, [text])

  const hasContent = text || zoneAlert

  return (
    <div className="border border-cyan-800 rounded p-3">
      <p className="text-cyan-400 text-xs font-bold tracking-widest mb-2 flex items-center gap-1.5">
        <Cpu className="w-3 h-3" /> AI INCIDENT ANALYSIS
        {isTyping && (
          <span className="ml-auto text-[9px] text-cyan-600 animate-pulse">
            ANALYZING...
          </span>
        )}
      </p>

      {/* Zone entry alert */}
      {zoneAlert && (
        <div className="bg-red-950/40 border border-red-800/60 rounded px-2 py-1.5 mb-2 text-xs text-red-400 font-bold flex items-center gap-1.5 animate-pulse">
          <span>⚠</span>
          {zoneAlert}
        </div>
      )}

      {/* Incident explanation text */}
      {hasContent ? (
        <div className="bg-cyan-950/20 border border-cyan-900/40 rounded px-2.5 py-2 text-[11px] text-cyan-300 leading-relaxed font-mono">
          {displayText || text}
          {isTyping && (
            <span
              className="inline-block w-1.5 h-3 bg-cyan-400 ml-0.5 animate-pulse"
              style={{ verticalAlign: "text-bottom" }}
            />
          )}
        </div>
      ) : (
        <p className="text-green-700 text-xs">No active incidents detected.</p>
      )}
    </div>
  )
}
