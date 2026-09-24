import { useState, useEffect, useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  chordFamily, loadChordDb, getRoots, getSuffixes, getChord, getPosition,
  chordName, suffixLabel, rootPitchClass, rootStringSet,
} from '../data/chords'
import ChordDiagram from './ChordDiagram'
import { Chip, Segmented } from './BottomSheet'

// The three qualities that cover most songs get a chip each; the rest of the
// database stays one tap further, in the "More" select.
const QUICK_SUFFIXES = [['major', 'Major'], ['minor', 'Minor'], ['7', '7']]

function ChordsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-[42px] rounded-xl bg-surface border border-line" />
      <div className="h-[86px] rounded-xl bg-surface border border-line" />
      <div className="h-80 rounded-[28px] bg-surface border border-line" />
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

  const moreSuffixes = suffixes.filter((x) => !QUICK_SUFFIXES.some(([q]) => q === x))
  const isMore = !QUICK_SUFFIXES.some(([q]) => q === safeSuffix)
  const pagerBtn = 'w-8 h-8 rounded-full flex items-center justify-center text-muted disabled:opacity-30 enabled:hover:text-ink enabled:hover:bg-well transition-colors cursor-pointer disabled:cursor-default'

  return (
    <div className="flex-1 flex flex-col gap-3.5">
      <Segmented
        options={[['browse', 'Browse'], ['pinned', `Pinned (${familyPins.length})`]]}
        value={subView}
        onChange={setSubView}
        well="bg-surface"
      />

      {subView === 'pinned' ? (
        /* ---- Pinned grid ---- */
        familyPins.length === 0 ? (
          <div className="flex-1 rounded-[28px] border border-dashed border-line px-6 py-12 flex flex-col items-center justify-center gap-3 text-center">
            <span className="text-brand"><StarIcon filled={false} /></span>
            <p className="text-sm leading-relaxed text-ink-2">
              No pinned chords yet.<br />Tap the star on a chord in Browse to add it.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[13px] font-medium text-muted">{familyPins.length} pinned</span>
              <button onClick={clearPins} className="text-[13px] font-medium text-muted hover:text-red-400 transition-colors cursor-pointer">
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {familyPins.map((item, idx) => {
                const pos = getPosition(db, item.root, item.suffix, item.pos)
                if (!pos) return null
                const accent = rootStringSet(pos, rootPitchClass(item.root))
                return (
                  <div key={`${item.root}|${item.suffix}|${item.pos}|${idx}`}
                    className="relative rounded-2xl bg-surface border border-line px-1.5 pt-3 pb-2 flex flex-col items-center gap-1.5">
                    <button onClick={() => removePin(item)} aria-label="Remove pin"
                      className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded-full flex items-center justify-center text-muted hover:text-red-400 transition-colors cursor-pointer">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="text-[15px] font-semibold leading-none">{chordName(item.root, item.suffix)}</div>
                    <button onClick={() => playChord(pos.midi, diapason)} aria-label={`Strum ${chordName(item.root, item.suffix)}`}
                      className="w-full flex justify-center active:scale-95 transition-transform cursor-pointer">
                      <ChordDiagram position={pos} strings={strings} accentSet={accent} dark={dark} small />
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )
      ) : (
        /* ---- Browse ---- */
        <>
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Root note">
            {roots.map((r) => (
              <Chip key={r} selected={r === safeRoot} onClick={() => onRootChange(r)}
                className="h-10 rounded-xl text-sm !font-semibold">
                {r}
              </Chip>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Chord quality">
            {QUICK_SUFFIXES.filter(([q]) => suffixes.includes(q)).map(([q, label]) => (
              <Chip key={q} selected={q === safeSuffix} onClick={() => onSuffixChange(q)}
                className="h-[38px] rounded-xl text-[13px]">
                {label}
              </Chip>
            ))}
            {/* Everything else chords-db knows, in a select dressed as a chip */}
            <div className="relative">
              <select value={isMore ? safeSuffix : ''} onChange={(e) => onSuffixChange(e.target.value)} aria-label="More chord qualities"
                className={`appearance-none w-full h-[38px] rounded-xl pl-3 pr-7 text-[13px] font-medium border truncate cursor-pointer focus:outline-none transition-colors ${
                  isMore ? 'border-brand/50 bg-brand/[0.12] text-ink' : 'border-line bg-card text-ink-2'
                }`}>
                <option value="" disabled>More</option>
                {moreSuffixes.map((x) => <option key={x} value={x}>{suffixLabel(x)}</option>)}
              </select>
              <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="flex-1 rounded-[28px] border px-5 py-6 flex flex-col items-center justify-center gap-4"
            style={{ background: 'linear-gradient(to bottom, var(--panel-from), var(--bg))', borderColor: 'var(--panel-line)', boxShadow: 'var(--panel-inset)' }}>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[56px] font-medium tracking-[-0.04em] leading-none">{chordName(safeRoot, safeSuffix)}</span>
              <span className="whitespace-nowrap text-[13px] text-muted">{suffixLabel(safeSuffix)} · tap to strum</span>
            </div>

            {position ? (
              <button onClick={strum} aria-label="Strum chord" className="w-full flex justify-center active:scale-[0.98] transition-transform cursor-pointer">
                <ChordDiagram position={position} strings={strings} accentSet={accentSet} dark={dark} />
              </button>
            ) : (
              <p className="text-sm text-faint py-10">No diagram available</p>
            )}

            {/* Voicing pager */}
            {positions.length > 0 && (
              <div className="flex items-center gap-2 justify-center -my-1">
                <button onClick={() => setPosIndex((i) => Math.max(0, i - 1))} disabled={effPos <= 0} className={pagerBtn} aria-label="Previous voicing">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
                </button>
                <span className="font-mono text-xs text-muted tabular-nums min-w-[96px] text-center">
                  {effPos + 1} / {positions.length} · {position.baseFret === 1 ? 'Open' : `${position.baseFret}fr`}
                </span>
                <button onClick={() => setPosIndex((i) => Math.min(positions.length - 1, i + 1))} disabled={effPos >= positions.length - 1} className={pagerBtn} aria-label="Next voicing">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
                </button>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button onClick={togglePin} aria-label={isPinned ? 'Unpin chord' : 'Pin chord'} aria-pressed={isPinned}
                className={`w-12 h-12 rounded-full flex items-center justify-center border transition-colors cursor-pointer ${
                  isPinned ? 'border-brand text-brand bg-brand/[0.12]' : 'border-line bg-surface text-muted hover:text-brand'
                }`}>
                <StarIcon filled={isPinned} />
              </button>
              <button onClick={strum}
                className="h-12 px-6 rounded-full bg-emerald-500 text-white text-[15px] font-semibold flex items-center gap-2 active:scale-[0.97] transition-transform cursor-pointer"
                style={{ boxShadow: '0 0 0 5px rgba(16,185,129,0.12)' }}>
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
