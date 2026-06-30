import { useRef } from 'react'
import { isInTune } from '../utils/noteUtils'

const CENTS_RANGE = 50
const TICKS = [-50, -25, 0, 25, 50]

export default function TunerBar({ cents, note, freq, inTuneThreshold = 5, displaySmooth = 0.12 }) {
  const displayCentsRef = useRef(0)

  if (note) {
    displayCentsRef.current = displayCentsRef.current * (1 - displaySmooth) + (cents ?? 0) * displaySmooth
  } else {
    displayCentsRef.current = 0
  }
  const displayCents = displayCentsRef.current

  const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, displayCents))
  const pct = ((clampedCents + CENTS_RANGE) / (CENTS_RANGE * 2)) * 100
  const inTune = note && isInTune(cents ?? 0, inTuneThreshold)
  const hasSignal = note !== null && note !== undefined
  const isSharp = hasSignal && !inTune && displayCents > 0
  const isFlat  = hasSignal && !inTune && displayCents < 0

  // -10 … +10 display scale (50 cents → 10 units)
  const rawUnit = (cents ?? 0) / 5
  const displayUnit = Math.max(-10, Math.min(10, Math.round(rawUnit)))

  const sig = !hasSignal ? 'zinc' : inTune ? 'emerald' : isSharp ? 'amber' : 'sky'
  const indicatorBg = { zinc: '#a1a1aa', emerald: '#10b981', amber: '#fbbf24', sky: '#38bdf8' }[sig]
  const indicatorGlow = {
    zinc: 'none', emerald: '0 0 12px rgba(16,185,129,0.65)',
    amber: '0 0 11px rgba(251,191,36,0.6)', sky: '0 0 11px rgba(56,189,248,0.6)',
  }[sig]

  const unitColor = !hasSignal ? 'text-zinc-400 dark:text-zinc-600'
    : inTune  ? 'text-emerald-500 dark:text-emerald-400'
    : isSharp ? 'text-amber-500 dark:text-amber-400'
    : 'text-sky-500 dark:text-sky-400'

  return (
    <div className="egt-enter flex flex-col gap-2.5">
      {/* Note name + scaled value + frequency */}
      <div className="flex items-end justify-center gap-3">
        <span className={`text-6xl font-bold tabular-nums leading-none transition-colors ${hasSignal ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700'}`}>
          {hasSignal ? note : '–'}
        </span>
        {hasSignal && (
          <div className="flex flex-col items-start mb-1 w-16">
            <span className={`text-lg font-semibold tabular-nums leading-none transition-colors ${unitColor}`}>
              {displayUnit > 0 ? '+' : ''}{displayUnit}
            </span>
            {freq ? (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums mt-1">
                {freq.toFixed(1)} Hz
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Tuner bar */}
      <div className="relative h-4 rounded-full bg-zinc-200 dark:bg-zinc-800/80 overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/5">
        {/* In-tune zone: width and position derived from inTuneThreshold */}
        <div
          className="absolute inset-y-0 rounded-[3px] bg-emerald-500/20 ring-1 ring-inset ring-emerald-500/30"
          style={{
            width: `${(inTuneThreshold / CENTS_RANGE) * 100}%`,
            left: `${50 - (inTuneThreshold / CENTS_RANGE) * 50}%`,
          }}
        />

        {/* Tick marks */}
        {TICKS.map(tick => {
          const isCenter = tick === 0
          const pctPos = tick + 50
          return (
            <div
              key={tick}
              className={`absolute w-0.5 z-10 ${isCenter
                ? 'h-3 top-[2px] bg-zinc-400 dark:bg-zinc-500'
                : 'h-1.5 top-[5px] bg-zinc-300 dark:bg-zinc-600'}`}
              style={{ left: `calc(${pctPos}% - 1px)` }}
            />
          )
        })}

        {/* Indicator dot — glows in its signal color */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full z-20 transition-[background-color,box-shadow] duration-75 ring-1 ring-black/10 dark:ring-white/20"
          style={{ left: `calc(${pct}% - 7px)`, backgroundColor: indicatorBg, boxShadow: indicatorGlow }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-600 px-0.5">
        <span className={isFlat ? 'text-sky-500 font-medium' : ''}>−10</span>
        <span className={`font-semibold tracking-wide ${inTune ? 'text-emerald-500' : ''}`}>
          {inTune ? '✓ IN TUNE' : isFlat ? '▲ tune up' : '▼ tune down'}
        </span>
        <span className={isSharp ? 'text-amber-500 font-medium' : ''}>+10</span>
      </div>
    </div>
  )
}
