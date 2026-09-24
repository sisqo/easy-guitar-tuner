import { useEffect } from 'react'

// Every secondary surface — menu, preset picker, install steps — is a sheet from
// the bottom: reachable with the thumb that is not holding the guitar neck.
export default function BottomSheet({ open, onClose, label, children, className = '' }) {
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px]"
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`egt-sheet fixed inset-x-0 bottom-0 z-[90] mx-auto max-w-lg max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-sheet border border-b-0 border-line px-4 pt-2.5 pb-[calc(20px+env(safe-area-inset-bottom))] flex flex-col gap-4 ${className}`}
        style={{ boxShadow: 'var(--panel-inset)' }}
      >
        <div className="flex justify-center">
          <span className="w-9 h-1 rounded-full bg-grabber" />
        </div>
        {children}
      </div>
    </>
  )
}

// A pill/tile chip for single-choice lists (instrument, tuning, chord root…)
export function Chip({ selected, onClick, className = '', children, ...rest }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`font-medium whitespace-nowrap border transition-colors cursor-pointer ${
        selected
          ? 'border-brand/50 bg-brand/[0.12] text-ink'
          : 'border-line bg-card text-ink-2 hover:text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// iOS-style segmented control: Tuner | Chords, Browse | Pinned
export function Segmented({ options, value, onChange, className = '', well = 'bg-well' }) {
  return (
    <div className={`flex p-[3px] gap-0.5 rounded-xl border border-line ${well} ${className}`}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={`flex-1 h-9 rounded-[9px] text-[13px] font-medium transition-colors cursor-pointer ${
            value === v ? 'bg-tab-on text-ink shadow-sm' : 'text-muted hover:text-ink-2'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
