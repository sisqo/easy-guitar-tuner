import { useEffect, useState } from 'react'

// Reads the detector's stats ref on its own clock rather than receiving props, so
// that watching the pipeline never adds a render to it. `acceptedPerSec` is the
// number to watch: it is what "responsive" actually means here — a reading that
// updates in bursts feels like a tuner that ignored you.
const POLL_MS = 100

const GATE_COLOR = {
  ok:      'text-emerald-500 dark:text-emerald-400',
  pending: 'text-amber-500 dark:text-amber-400',
  outlier: 'text-amber-500 dark:text-amber-400',
  hold:    'text-sky-500 dark:text-sky-400',
  noise:   'text-zinc-400 dark:text-zinc-600',
  clarity: 'text-zinc-400 dark:text-zinc-600',
  range:   'text-zinc-400 dark:text-zinc-600',
  idle:    'text-zinc-400 dark:text-zinc-600',
}

function Row({ label, value, className = '' }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-400 dark:text-zinc-600">{label}</span>
      <span className={`tabular-nums ${className || 'text-zinc-700 dark:text-zinc-300'}`}>{value}</span>
    </div>
  )
}

export default function DebugOverlay({ statsRef }) {
  const [s, setS] = useState(() => ({ ...statsRef.current }))

  useEffect(() => {
    const id = setInterval(() => setS({ ...statsRef.current }), POLL_MS)
    return () => clearInterval(id)
  }, [statsRef])

  const windowMs = s.sampleRate ? (s.windowSize / s.sampleRate) * 1000 : 0

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-black/40 px-3 py-2 font-mono text-[10px] leading-relaxed">
      <div className="grid grid-cols-2 gap-x-4">
        <Row label="raw" value={s.rawHz ? `${s.rawHz.toFixed(2)} Hz` : '—'} />
        <Row label="tracked" value={s.smoothedHz ? `${s.smoothedHz.toFixed(2)} Hz` : '—'} />
        <Row label="clarity" value={s.clarity ? s.clarity.toFixed(3) : '—'} />
        <Row label="rms" value={s.rms ? s.rms.toFixed(4) : '—'} />
        <Row label="gate" value={s.gate} className={GATE_COLOR[s.gate] ?? ''} />
        <Row label="accepted/s" value={s.acceptedPerSec} />
        <Row label="analyses/s" value={s.analysesPerSec} />
        <Row
          label="window"
          value={s.windowSize ? `${s.windowSize} · ${windowMs.toFixed(0)} ms` : '—'}
        />
      </div>
    </div>
  )
}
