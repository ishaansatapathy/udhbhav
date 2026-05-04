/**
 * RiskScorePanel — Displays the dynamic risk score (0–100)
 * with a color-coded progress bar. Matches the tactical/monospace UI
 * style of the PoliceDashboard.
 */

import { ShieldAlert } from "lucide-react"

interface Props {
  score: number
  color: string
  label: string
  onReset?: () => void
}

export default function RiskScorePanel({ score, color, label, onReset }: Props) {
  return (
    <div className="border border-green-700 rounded p-3">
      <p className="text-green-500 text-xs font-bold tracking-widest mb-2 flex items-center gap-1.5">
        <ShieldAlert className="w-3 h-3" /> RISK ASSESSMENT
        <span
          className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            color,
            background: `${color}15`,
            border: `1px solid ${color}40`,
          }}
        >
          {label}
        </span>
      </p>

      {/* Score display */}
      <div className="flex items-end gap-1.5 mb-2">
        <span
          className="text-2xl font-black tabular-nums leading-none"
          style={{ color }}
        >
          {score}
        </span>
        <span className="text-green-700 text-xs mb-0.5">/100</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-green-900/40 overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>

      {/* Score breakdown labels */}
      <div className="flex justify-between text-[9px] text-green-700 mb-1">
        <span>DANGER</span>
        <span>CAUTION</span>
        <span>SAFE</span>
      </div>

      {onReset && (
        <button
          onClick={onReset}
          className="w-full mt-1 py-1 text-[10px] font-bold rounded border border-green-800 text-green-600 hover:bg-green-900/30 hover:text-green-400 transition-colors"
        >
          RESET SCORE
        </button>
      )}
    </div>
  )
}
