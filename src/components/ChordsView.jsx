import { useState, useEffect, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  chordFamily, loadChordDb, getRoots, getSuffixes, getChord, getPosition,
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

function StarIcon({ filled }) {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.06 4.18c.08.16.24.28.42.3l4.6.67c.45.07.63.62.3.94l-3.33 3.25a.56.56 0 0 0-.16.5l.79 4.58c.08.45-.4.79-.8.58l-4.12-2.17a.56.56 0 0 0-.52 0l-4.12 2.17c-.4.21-.88-.13-.8-.58l.79-4.58a.56.56 0 0 0-.16-.5L4.1 9.59c-.33-.32-.15-.87.3-.94l4.6-.67a.56.56 0 0 0 .42-.3z" />
    </svg>
  )
}

export default function ChordsView({
  instrument, diapason, dark, playChord, root, suffix, onRootChange, onSuffixChange,
}) {
  const family = chordFamily(instrument)
  const [db, setDb] = useState(null)
  const [loading, setLoading] = useState(true)
  const [posIndex, setPosIndex] = useState(0)
  const [subView, setSubView] = useState('browse')
  const [pins, setPins] = useLocalStorage('egt-pinned-chords', {})

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

  useEffect(() => { setPosIndex(0) }, [safeRoot, safeSuffix, family])

  const chord = db ? getChord(db, safeRoot, safeSuffix) : null
  const positions = chord?.positions ?? []
  const effPos = positions.length ? Math.min(posIndex, positions.length - 1) : 0
  const position = positions[effPos] ?? null
  const strings = db?.main?.strings ?? 6
  const accentSet = useMemo(
    () => (position ? rootStringSet(position, rootPitchClass(safeRoot)) : new Set()),
    [position, safeRoot],
  )

  const familyPins = pins[family] ?? []
  const isPinned = familyPins.some((p) => p.root === safeRoot && p.suffix === safeSuffix && p.pos === effPos)

  const strum = () => { if (position?.midi) playChord(position.midi, diapason) }

  function togglePin() {
    setPins((prev) => {
      const list = prev[family] ?? []
      const exists = list.some((p) => p.root === safeRoot && p.suffix === safeSuffix && p.pos === effPos)
      const next = exists
        ? list.filter((p) => !(p.root === safeRoot && p.suffix === safeSuffix && p.pos === effPos))
        : [...list, { root: safeRoot, suffix: safeSuffix, pos: effPos }]
      return { ...prev, [family]: next }
    })
  }

  function removePin(item) {
    setPins((prev) => ({
      ...prev,
      [family]: (prev[family] ?? []).filter(
        (p) => !(p.root === item.root && p.suffix === item.suffix && p.pos === item.pos),
      ),
    }))
  }

  function clearPins() {
    if (familyPins.length && window.confirm('Remove all pinned chords?')) {
      setPins((prev) => ({ ...prev, [family]: [] }))
    }
  }

  if (loading) return <ChordsSkeleton />

  return (
    <div className="flex flex-col gap-4">
      {/* Browse | Pinned toggle */}
      <div className="flex p-1 gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/60">
        {[['browse', 'Browse'], ['pinned', `Pinned (${familyPins.length})`]].map(([v, label]) => (
          <button key={v} onClick={() => setSubView(v)}
            className={`flex-1 h-9 rounded-md text-sm font-semibold transition-colors ${
              subView === v
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {subView === 'pinned' ? (
        /* ---- Pinned grid ---- */
        familyPins.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 px-6 py-12 flex flex-col items-center gap-3 text-center">
            <span className="text-[#2aab9e]"><StarIcon filled={false} /></span>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              No pinned chords yet.<br />Tap the <span className="text-[#2aab9e] font-semibold">★</span> on a chord in Browse to add it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {familyPins.length} pinned
              </span>
              <button onClick={clearPins} className="text-xs font-medium text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors">
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {familyPins.map((item, idx) => {
                const pos = getPosition(db, item.root, item.suffix, item.pos)
                if (!pos) return null
                const accent = rootStringSet(pos, rootPitchClass(item.root))
                return (
                  <div key={`${item.root}|${item.suffix}|${item.pos}|${idx}`}
                    className="relative rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-1.5 pt-2 pb-1.5 flex flex-col items-center gap-1">
                    <button onClick={() => removePin(item)} aria-label="Remove pin"
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">{chordName(item.root, item.suffix)}</div>
                    <button onClick={() => playChord(pos.midi, diapason)} aria-label={`Strum ${chordName(item.root, item.suffix)}`}
                      className="w-full active:scale-95 transition-transform">
                      <ChordDiagram position={pos} strings={strings} accentSet={accent} dark={dark} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : (
        /* ---- Browse ---- */
        <>
          {/* Root note selector */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Root note">
            {roots.map((r) => {
              const active = r === safeRoot
              return (
                <button key={r} onClick={() => onRootChange(r)}
                  className={`shrink-0 min-w-[42px] h-9 px-2 rounded-lg text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-[#2aab9e] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                  }`}>
                  {r}
                </button>
              )
            })}
          </div>

          {/* Quality dropdown */}
          <div className="relative">
            <select value={safeSuffix} onChange={(e) => onSuffixChange(e.target.value)} aria-label="Chord quality"
              className="appearance-none w-full h-10 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 rounded-lg pl-3 pr-9 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer text-sm font-medium transition-colors">
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
                <button onClick={() => setPosIndex((i) => Math.max(0, i - 1))} disabled={effPos <= 0}
                  className="p-1.5 rounded-lg text-zinc-500 disabled:opacity-30 enabled:hover:bg-zinc-100 dark:enabled:hover:bg-zinc-800 transition-colors" aria-label="Previous voicing">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums min-w-[96px] text-center">
                  {effPos + 1} / {positions.length} · {position.baseFret === 1 ? 'Open' : `${position.baseFret}fr`}
                </span>
                <button onClick={() => setPosIndex((i) => Math.min(positions.length - 1, i + 1))} disabled={effPos >= positions.length - 1}
                  className="p-1.5 rounded-lg text-zinc-500 disabled:opacity-30 enabled:hover:bg-zinc-100 dark:enabled:hover:bg-zinc-800 transition-colors" aria-label="Next voicing">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            )}

            {/* Pin + Strum */}
            <div className="mt-1 flex items-center gap-3">
              <button onClick={togglePin} aria-label={isPinned ? 'Unpin chord' : 'Pin chord'}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
                  isPinned
                    ? 'border-[#2aab9e] text-[#2aab9e] bg-[#2aab9e]/10'
                    : 'border-zinc-300 text-zinc-400 hover:text-[#2aab9e] hover:border-[#2aab9e] dark:border-zinc-700 dark:text-zinc-500'
                }`}>
                <StarIcon filled={isPinned} />
              </button>
              <button onClick={strum}
                className="flex items-center gap-2 px-5 h-10 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500 text-white text-sm font-semibold shadow-sm shadow-emerald-500/20 active:scale-[0.97] transition-transform">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                Strum
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
