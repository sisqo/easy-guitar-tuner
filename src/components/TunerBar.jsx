import { useRef } from 'react'
import { isInTune } from '../utils/noteUtils'

const CENTS_RANGE = 50
const DISPLAY_SMOOTH = 0.2  // EMA for the visual indicator

export default function TunerBar({ cents, note, listening, lockedString }) {
  const displayCentsRef = useRef(0)

  // Smooth the visual position of the indicator
  if (note) {
    displayCentsRef.current = displayCentsRef.current * (1 - DISPLAY_SMOOTH) + (cents ?? 0) * DISPLAY_SMOOTH
  } else {
    displayCentsRef.current = 0
  }
  const displayCents = displayCentsRef.current

  const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, displayCents))
  const pct = ((clampedCents + CENTS_RANGE) / (CENTS_RANGE * 2)) * 100
  const inTune = note && isInTune(cents ?? 0, 3)
  const hasSignal = note !== null && note !== undefined

  const barColor = !hasSignal
    ? 'bg-zinc-600'
    : inTune
    ? 'bg-emerald-500'
    : Math.abs(cents) > 30
    ? 'bg-red-500'
    : 'bg-amber-400'

  const centsRounded = Math.round(cents ?? 0)

  return (
    <div className="flex flex-col gap-3">
      {/* Target string label when locked */}
      {lockedString && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
          <span>Locked to <strong className="text-zinc-300">{lockedString.label}</strong> — tap it to unlock</span>
        </div>
      )}

      {/* Note name + cents */}
      <div className="flex items-end justify-center gap-3">
        <span className={`text-6xl font-bold tabular-nums transition-colors ${hasSignal ? 'text-zinc-100' : 'text-zinc-700'}`}>
          {hasSignal ? note : '--'}
        </span>
        {hasSignal && (
          <span className={`text-lg font-semibold mb-2 tabular-nums w-20
            ${inTune ? 'text-emerald-400' : Math.abs(centsRounded) > 30 ? 'text-red-400' : 'text-amber-400'}`}>
            {centsRounded > 0 ? '+' : ''}{centsRounded}¢
          </span>
        )}
      </div>

      {/* Tuner bar */}
      <div className="relative h-4 rounded-full bg-zinc-800 overflow-hidden">
        {/* Zone markers at ±5 cents */}
        <div className="absolute inset-y-0 bg-emerald-900/40 rounded-full"
          style={{ left: 'calc(50% - 5%)', width: '10%' }} />
        {/* Center marker */}
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-zinc-600 -translate-x-1/2 z-10" />
        {/* Indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-lg z-20 transition-colors duration-75 ${barColor}`}
          style={{ left: `calc(${pct}% - 8px)` }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-zinc-600 px-0.5">
        <span>-50¢</span>
        <span className={`font-semibold ${inTune ? 'text-emerald-500' : 'text-zinc-600'}`}>
          {inTune ? '✓ IN TUNE' : 'TUNE'}
        </span>
        <span>+50¢</span>
      </div>

      {!listening && (
        <p className="text-center text-xs text-zinc-600">Enable mic or play a reference note</p>
      )}
    </div>
  )
}
