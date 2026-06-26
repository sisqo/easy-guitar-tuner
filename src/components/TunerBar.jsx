import { isInTune } from '../utils/noteUtils'

const CENTS_RANGE = 50

export default function TunerBar({ cents, note, listening }) {
  const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, cents ?? 0))
  const pct = ((clampedCents + CENTS_RANGE) / (CENTS_RANGE * 2)) * 100
  const inTune = note && isInTune(cents ?? 0)
  const hasSignal = note !== null && note !== undefined

  const barColor = !hasSignal
    ? 'bg-zinc-600'
    : inTune
    ? 'bg-emerald-500'
    : Math.abs(cents) > 30
    ? 'bg-red-500'
    : 'bg-amber-400'

  return (
    <div className="flex flex-col gap-3">
      {/* Note name */}
      <div className="flex items-end justify-center gap-3">
        <span className={`text-6xl font-bold tabular-nums transition-colors ${hasSignal ? 'text-zinc-100' : 'text-zinc-700'}`}>
          {hasSignal ? note : '--'}
        </span>
        {hasSignal && (
          <span className={`text-lg font-semibold mb-2 tabular-nums ${inTune ? 'text-emerald-400' : 'text-zinc-400'}`}>
            {cents > 0 ? '+' : ''}{Math.round(cents)}¢
          </span>
        )}
      </div>

      {/* Tuner bar */}
      <div className="relative h-3 rounded-full bg-zinc-800 dark:bg-zinc-900 overflow-hidden">
        {/* Center marker */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-600 -translate-x-1/2 z-10" />

        {/* Indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-75 ${barColor} shadow-lg`}
          style={{ left: `calc(${pct}% - 6px)` }}
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

      {/* Listening status */}
      {!listening && (
        <p className="text-center text-xs text-zinc-600">Enable mic or play a reference note</p>
      )}
    </div>
  )
}
