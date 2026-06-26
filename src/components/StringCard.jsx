import { isInTune } from '../utils/noteUtils'

export default function StringCard({ string, active, cents, onPlay }) {
  const inTune = active && isInTune(cents ?? 0)

  const borderColor = !active
    ? 'border-zinc-800 dark:border-zinc-800'
    : inTune
    ? 'border-emerald-500'
    : Math.abs(cents) > 30
    ? 'border-red-500'
    : 'border-amber-400'

  const bgColor = active
    ? inTune
      ? 'bg-emerald-950/40 dark:bg-emerald-950/60'
      : 'bg-zinc-800 dark:bg-zinc-900'
    : 'bg-zinc-900 dark:bg-zinc-950'

  return (
    <div className={`rounded-xl border-2 p-3 transition-all duration-150 ${borderColor} ${bgColor}`}>
      <div className="flex items-center justify-between gap-2">
        {/* Note label */}
        <span className={`text-lg font-bold tabular-nums ${active ? 'text-zinc-100' : 'text-zinc-500'}`}>
          {string.label}
        </span>

        {/* Cents badge when active */}
        {active && (
          <span className={`text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded
            ${inTune ? 'text-emerald-400' : 'text-amber-400'}`}>
            {cents > 0 ? '+' : ''}{Math.round(cents)}¢
          </span>
        )}

        {/* Play button */}
        <button
          onClick={() => onPlay(string.freq)}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
          aria-label={`Play ${string.label}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7L8 5z"/>
          </svg>
        </button>
      </div>

      {/* Freq */}
      <div className="text-xs text-zinc-600 mt-0.5 tabular-nums">
        {string.freq.toFixed(1)} Hz
      </div>
    </div>
  )
}
