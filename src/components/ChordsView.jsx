import { useState, useEffect, useMemo } from 'react'
import {
  chordFamily, loadChordDb, getRoots, getSuffixes, getChord,
  chordName, suffixLabel, rootPitchClass, rootStringSet,
} from '../data/chords'
import ChordDiagram from './ChordDiagram'

function ChordsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-9 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-10 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 h-72 bg-zinc-100 dark:bg-zinc-900/60" />
    </div>
  )
}

export default function ChordsView({
  instrument, diapason, dark, playChord, root, suffix, onRootChange, onSuffixChange,
}) {
  const family = chordFamily(instrument)
  const [db, setDb] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posIndex, setPosIndex] = useState(0)

  // Lazy-load the chord database for the current instrument family
  useEffect(() => {
    let alive = true
    setLoading(true)
    loadChordDb(family).then((d) => { if (alive) { setDb(d); setLoading(false) } })
    return () => { alive = false }
  }, [family])

  const roots = db ? getRoots(db) : []
  const safeRoot = db ? (roots.includes(root) ? root : roots[0]) : root
  const suffixes = useMemo(() => (db ? getSuffixes(db, safeRoot) : []), [db, safeRoot])
  const safeSuffix = suffixes.includes(suffix) ? suffix : (suffixes.includes('major') ? 'major' : suffixes[0])

  // Reset to the easiest voicing whenever the chord changes
  useEffect(() => { setPosIndex(0) }, [safeRoot, safeSuffix, family])

  const chord = db ? getChord(db, safeRoot, safeSuffix) : null
  const positions = chord?.positions ?? []
  const position = positions[Math.min(posIndex, positions.length - 1)] ?? null
  const strings = db?.main?.strings ?? 6
  const accentSet = useMemo(
    () => (position ? rootStringSet(position, rootPitchClass(safeRoot)) : new Set()),
    [position, safeRoot],
  )

  const strum = () => { if (position?.midi) playChord(position.midi, diapason) }

  if (loading) return <ChordsSkeleton />

  return (
    <div className="flex flex-col gap-4">
      {/* Root note selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Root note">
        {roots.map((r) => {
          const active = r === safeRoot
          return (
            <button
              key={r}
              onClick={() => onRootChange(r)}
              className={`shrink-0 min-w-[42px] h-9 px-2 rounded-lg text-sm font-semibold transition-colors ${
                active
                  ? 'bg-[#2aab9e] text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {r}
            </button>
          )
        })}
      </div>

      {/* Quality dropdown */}
      <div className="relative">
        <select
          value={safeSuffix}
          onChange={(e) => onSuffixChange(e.target.value)}
          aria-label="Chord quality"
          className="appearance-none w-full h-10 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-lg pl-3 pr-9 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer text-sm font-medium transition-colors"
        >
          {suffixes.map((s) => <option key={s} value={s}>{suffixLabel(s)}</option>)}
        </select>
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Chord card */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-5 flex flex-col items-center gap-3">
        <div className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 tabular-nums">
          {chordName(safeRoot, safeSuffix)}
        </div>

        {position ? (
          <button onClick={strum} aria-label="Strum chord" className="active:scale-[0.98] transition-transform">
            <ChordDiagram position={position} strings={strings} accentSet={accentSet} dark={dark} />
          </button>
        ) : (
          <p className="text-sm text-zinc-400 dark:text-zinc-600 py-10">No diagram available</p>
        )}

        {/* Voicing pager */}
        {positions.length > 0 && (
          <div className="flex items-center gap-3 justify-center">
            <button onClick={() => setPosIndex((i) => Math.max(0, i - 1))} disabled={posIndex <= 0}
              className="p-1.5 rounded-lg text-zinc-500 disabled:opacity-30 enabled:hover:bg-zinc-100 dark:enabled:hover:bg-zinc-800 transition-colors" aria-label="Previous voicing">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums min-w-[96px] text-center">
              {posIndex + 1} / {positions.length} · {position.baseFret === 1 ? 'Open' : `${position.baseFret}fr`}
            </span>
            <button onClick={() => setPosIndex((i) => Math.min(positions.length - 1, i + 1))} disabled={posIndex >= positions.length - 1}
              className="p-1.5 rounded-lg text-zinc-500 disabled:opacity-30 enabled:hover:bg-zinc-100 dark:enabled:hover:bg-zinc-800 transition-colors" aria-label="Next voicing">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        )}

        {/* Strum */}
        <button onClick={strum}
          className="mt-1 flex items-center gap-2 px-5 h-10 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-sm shadow-emerald-500/20 active:scale-[0.97] transition-transform">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          Strum
        </button>
      </div>
    </div>
  )
}
