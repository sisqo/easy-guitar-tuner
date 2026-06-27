import { useRef } from 'react'
import { isInTune } from '../utils/noteUtils'

const CENTS_RANGE = 50
const TICKS = [-50, -25, 0, 25, 50]

export default function TunerBar({ cents, note, listening, inTuneThreshold = 5, displaySmooth = 0.12 }) {
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

  const indicatorColor = !hasSignal ? 'bg-zinc-400 dark:bg-zinc-600'
    : inTune  ? 'bg-emerald-500'
    : isSharp ? 'bg-amber-400'
    : 'bg-sky-400'

  const unitColor = !hasSignal ? 'text-zinc-400 dark:text-zinc-600'
    : inTune  ? 'text-emerald-500 dark:text-emerald-400'
    : isSharp ? 'text-amber-500 dark:text-amber-400'
    : 'text-sky-500 dark:text-sky-400'

  return (
    <div className="flex flex-col gap-2">
      {/* Note name + scaled value */}
      <div className="flex items-end justify-center gap-3">
        <span className={`text-6xl font-bold tabular-nums transition-colors ${hasSignal ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700'}`}>
          {hasSignal ? note : '--'}
        </span>
        {hasSignal && (
          <span className={`text-lg font-semibold mb-2 tabular-nums w-16 ${unitColor}`}>
            {displayUnit > 0 ? '+' : ''}{displayUnit}
          </span>
        )}
      </div>

      {/* Tuner bar */}
      <div className="relative h-4 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        {/* Green zone: width and position derived from inTuneThreshold */}
        <div
          className="absolute inset-y-0 bg-emerald-500/20 border-l border-r border-emerald-500/40"
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
              className={`absolute w-0.5 bg-zinc-400 dark:bg-zinc-600 z-10 ${isCenter ? 'h-3 top-[2px]' : 'h-1.5 top-[5px]'}`}
              style={{ left: `calc(${pctPos}% - 1px)` }}
            />
          )
        })}

        {/* Indicator dot */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full shadow-lg z-20 transition-colors duration-75 ${indicatorColor}`}
          style={{ left: `calc(${pct}% - 7px)` }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-600 px-0.5">
        <span className={isFlat ? 'text-sky-500 font-medium' : ''}>−10</span>
        <span className={`font-semibold ${inTune ? 'text-emerald-500' : ''}`}>
          {inTune ? '✓ IN TUNE' : 'TUNE'}
        </span>
        <span className={isSharp ? 'text-amber-500 font-medium' : ''}>+10</span>
      </div>
    </div>
  )
}
