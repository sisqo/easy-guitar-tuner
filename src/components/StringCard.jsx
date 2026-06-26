import { isInTune } from '../utils/noteUtils'

export default function StringCard({ string, active, cents, locked, onLockToggle, onPlay }) {
  const inTune = active && isInTune(cents ?? 0, 3)

  const borderColor = locked
    ? 'border-sky-500'
    : !active
    ? 'border-zinc-800'
    : inTune
    ? 'border-emerald-500'
    : Math.abs(cents) > 30
    ? 'border-red-500'
    : 'border-amber-400'

  const bgColor = locked
    ? 'bg-sky-950/40'
    : active
    ? inTune
      ? 'bg-emerald-950/40'
      : 'bg-zinc-800'
    : 'bg-zinc-900'

  return (
    <div
      className={`rounded-xl border-2 p-3 transition-all duration-150 cursor-pointer select-none ${borderColor} ${bgColor}`}
      onClick={() => onLockToggle(string.id)}
    >
      <div className="flex items-center justify-between gap-1">
        {/* Note label */}
        <span className={`text-lg font-bold tabular-nums ${active || locked ? 'text-zinc-100' : 'text-zinc-500'}`}>
          {string.label}
        </span>

        {/* Lock icon or cents badge */}
        {locked ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-sky-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
        ) : active && cents !== null ? (
          <span className={`text-xs font-semibold tabular-nums px-1 py-0.5 rounded shrink-0
            ${inTune ? 'text-emerald-400' : 'text-amber-400'}`}>
            {cents > 0 ? '+' : ''}{Math.round(cents)}¢
          </span>
        ) : null}

        {/* Play button */}
        <button
          onClick={e => { e.stopPropagation(); onPlay(string.freq) }}
          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors shrink-0"
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
