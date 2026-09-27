import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useSettings } from './hooks/useSettings'
import { usePresets } from './hooks/usePresets'
import { usePitchDetector } from './hooks/usePitchDetector'
import { useOscillator } from './hooks/useOscillator'
import { useSuccessBeep } from './hooks/useSuccessBeep'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { useWakeLock } from './hooks/useWakeLock'
import { getTunings, buildCustomTuning, customSlotCount, customTuningKey, tuningToSlots } from './data/tunings'
import { DEFAULT_PRESET_ID } from './data/settings'
import { findClosestString, freqToNoteName, getCents, nearestNote } from './utils/noteUtils'
import MenuSheet from './components/MenuSheet'
import BottomSheet from './components/BottomSheet'
import AppLogo from './components/AppLogo'
import TunerBar from './components/TunerBar'
import GuitarHeadstock from './components/GuitarHeadstock'
import MicButton from './components/MicButton'
import SettingsPanel from './components/SettingsPanel'
import PresetSelector from './components/PresetSelector'
import ChordsView from './components/ChordsView'
import DebugOverlay from './components/DebugOverlay'
import InputLevel from './components/InputLevel'
import TuningEditor from './components/TuningEditor'

// How long the pitch must stay inside the in-tune zone before the success beep
// fires. Shorter than it used to be because the zone itself is now ±3 cents:
// holding 1500 ms inside a zone that narrow is a different ask entirely.
const IN_TUNE_BEEP_MS = 900

// Once green, it takes this much extra drift to go back to off. The headstock's
// emerald ring is an SVG attribute with no CSS transition, so without hysteresis a
// string parked on the edge of the zone makes it strobe.
const HYSTERESIS_CENTS = 2

// How long "✓ E2 tuned" replaces the instruction, and the button's ring plays
const TUNED_FLASH_MS = 1400

// Short-long-short when a string is marked tuned — for whoever cannot hear the
// beep over the room. Android only; iOS Safari has no Vibration API.
const TUNED_VIBRATE = [30, 50, 60]

function AutoToggle({ lockedStringId, activeStringId, strings, onToggle }) {
  const isLocked = lockedStringId !== null
  const lockedString = isLocked ? strings.find(s => s.id === lockedStringId) : null

  function handleClick() {
    if (isLocked) {
      onToggle(lockedStringId)
    } else if (activeStringId !== null) {
      onToggle(activeStringId)
    }
  }

  return (
    <button
      onClick={handleClick}
      aria-label={isLocked ? `Locked to ${lockedString?.label ?? 'string'} — tap to switch to Auto` : 'Auto mode — tap a string or here to lock'}
      className={`h-10 px-3.5 rounded-full flex items-center gap-2 shrink-0 border text-[13px] whitespace-nowrap transition-colors cursor-pointer active:scale-[0.97] ${
        isLocked
          ? 'font-semibold border-sky-400/45 bg-sky-400/10'
          : 'font-medium border-line bg-surface text-ink-2 hover:text-ink'
      }`}
      style={isLocked ? { color: 'var(--lock-fg)' } : undefined}
    >
      {isLocked ? (
        <>
          <svg className="w-[13px] h-[13px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {lockedString?.label ?? '—'}
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          Auto detect
        </>
      )}
    </button>
  )
}

export default function App() {
  const [dark, setDark] = useLocalStorage('egt-dark', true)
  const [instrument, setInstrument] = useLocalStorage('egt-instrument', 'guitar6')
  const [lefty, setLefty] = useLocalStorage('egt-lefty', false)
  // A sustained reference tone is sounding (a headstock button held down)
  const [refHeld, setRefHeld] = useState(false)
  const [tuningKey, setTuningKey] = useLocalStorage('egt-tuning', 'standard')
  const [lockedStringId, setLockedStringId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [tunedStrings, setTunedStrings] = useState(() => new Set())
  // { stringId, label, key } for TUNED_FLASH_MS after a string is first marked tuned
  const [tunedFlash, setTunedFlash] = useState(null)
  const [iosSheetOpen, setIosSheetOpen] = useState(false)
  // Chords section — view always opens on the tuner; chord selection persists for the session
  const [view, setView] = useState('tuner')
  const [chordRoot, setChordRoot] = useState('C')
  const [chordSuffix, setChordSuffix] = useState('major')
  // { [instrument]: [{ id, name, notes: [midi, …] }] } — see tunings.js
  const [customTunings, setCustomTunings] = useLocalStorage('egt-custom-tunings', {})
  // The open tuning editor: { id (null for a new one), initial, key }
  const [editor, setEditor] = useState(null)

  const { canInstall, isIOS, showInstallOption, install } = useInstallPrompt()

  const { settings, update, applyValues, resetAll } = useSettings()
  const preset = usePresets(settings, applyValues)

  // "Reset to defaults" writes the whole settings object — reference pitch and
  // debug switch included — so the preset is only marked, not re-applied on top.
  const handleResetAll = useCallback(() => {
    resetAll()
    preset.setActivePreset(DEFAULT_PRESET_ID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetAll, preset.setActivePreset])

  // Keep a ref so the RAF loop in usePitchDetector always reads latest settings
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const allTunings = useMemo(() => getTunings(settings.diapason), [settings.diapason])
  const baseInstrument = allTunings[instrument] ?? allTunings.guitar6
  const chromatic = !!baseInstrument.chromatic
  // The user's own tunings sit after the built-ins, rebuilt at the current diapason.
  // Anything stored with the wrong number of slots (a hand-edited or older entry) is skipped.
  const customList = useMemo(() => {
    const list = Array.isArray(customTunings?.[instrument]) ? customTunings[instrument] : []
    return list.filter(t => t && typeof t.name === 'string' && Array.isArray(t.notes)
      && t.notes.length === customSlotCount(instrument) && t.notes.every(Number.isFinite))
  }, [customTunings, instrument])
  const instrumentData = useMemo(() => {
    if (!customList.length) return baseInstrument
    const custom = Object.fromEntries(customList.map(t =>
      [customTuningKey(t.id), buildCustomTuning(instrument, t, settings.diapason)]))
    return { ...baseInstrument, tunings: { ...baseInstrument.tunings, ...custom } }
  }, [baseInstrument, customList, instrument, settings.diapason])
  const safeTuningKey = instrumentData.tunings[tuningKey] ? tuningKey : 'standard'
  const strings = instrumentData.tunings[safeTuningKey].strings
  const instrumentOptions = useMemo(
    () => Object.entries(allTunings).map(([id, d]) => ({ id, label: d.label })),
    [allTunings],
  )

  // Keep a ref so the RAF loop can do string-aware octave correction without restart
  const stringsRef = useRef(strings)
  useEffect(() => { stringsRef.current = strings }, [strings])

  const { isListening, pitch, settling, error, start, stop, statsRef } = usePitchDetector(settingsRef, stringsRef)
  const { playNote, playChord, startTone, stopTone } = useOscillator()
  // Stable, for the memoized headstock
  const handleHoldStart = useCallback((freq) => { startTone(freq); setRefHeld(true) }, [startTone])
  const handleHoldEnd = useCallback(() => { stopTone(); setRefHeld(false) }, [stopTone])
  const { beep } = useSuccessBeep()
  useWakeLock(isListening)

  const resetTuned = useCallback(() => {
    setTunedStrings(new Set())
    setTunedFlash(null)
  }, [])

  const handleStop = useCallback(() => {
    stop()
    resetTuned()
  }, [stop, resetTuned])

  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closeIosSheet = useCallback(() => setIosSheetOpen(false), [])

  // Switching to Chords stops the mic (you're not tuning) to save battery
  const handleViewChange = useCallback((v) => {
    setView(v)
    if (v === 'chords' && isListening) handleStop()
  }, [isListening, handleStop])

  function handleInstrumentChange(id) {
    setInstrument(id)
    setTuningKey('standard')
    setLockedStringId(null)
    resetTuned()
  }
  function handleTuningChange(key) {
    setTuningKey(key)
    setLockedStringId(null)
    resetTuned()
  }
  // useCallback so the memoized GuitarHeadstock actually gets to skip renders:
  // a fresh function identity here would defeat it on every pitch update.
  const handleLockToggle = useCallback((stringId) => {
    setLockedStringId(prev => prev === stringId ? null : stringId)
  }, [])

  function openNewTuning() {
    // Starts from whatever is selected: most custom tunings are one or two strings off a known one
    setEditor({ id: null, initial: { name: '', notes: tuningToSlots(instrument, strings) }, key: Date.now() })
  }
  function openEditTuning() {
    const t = customList.find(c => customTuningKey(c.id) === safeTuningKey)
    if (t) setEditor({ id: t.id, initial: { name: t.name, notes: t.notes }, key: Date.now() })
  }
  function saveTuning({ name, notes }) {
    const id = editor.id ?? Date.now().toString(36)
    setCustomTunings(prev => {
      const list = Array.isArray(prev?.[instrument]) ? prev[instrument] : []
      const next = editor.id !== null
        ? list.map(t => (t.id === id ? { id, name, notes } : t))
        : [...list, { id, name, notes }]
      return { ...prev, [instrument]: next }
    })
    handleTuningChange(customTuningKey(id))
    setEditor(null)
  }
  function deleteTuning() {
    const id = editor.id
    setCustomTunings(prev => ({ ...prev, [instrument]: (prev?.[instrument] ?? []).filter(t => t.id !== id) }))
    handleTuningChange('standard')
    setEditor(null)
  }

  function handleInstall() {
    if (canInstall) {
      install()
    } else if (isIOS) {
      setIosSheetOpen(true)
    }
  }

  // The big letter names the string being tuned, because that is what the cents
  // are measured against. It used to be the chromatic name of the pitch, so a low E
  // sixty cents flat read "D#2" next to "−60" — two labels, two references. When
  // what is sounding is a different note, it is shown separately as `soundingNote`.
  const { displayNote, soundingNote, displayCents, activeStringId, activeFreq } = useMemo(() => {
    const target = chromatic
      ? nearestNote(pitch, settings.diapason)
      : lockedStringId !== null
        ? strings.find(s => s.id === lockedStringId) ?? null
        : findClosestString(pitch, strings)
    if (!pitch || !target) {
      return { displayNote: null, soundingNote: null, displayCents: 0, activeStringId: lockedStringId, activeFreq: target?.freq ?? null }
    }
    const sounding = freqToNoteName(pitch, settings.diapason)
    return {
      // The ʼ / ˡ marks tell a course's twin pegs apart on the headstock buttons;
      // on the big letter they are noise. The label itself is kept rather than
      // rebuilt from note+octave, so the half-step tunings still read "Eb2".
      displayNote: target.label.replace(/[ʼˡ]/g, ''),
      soundingNote: sounding !== freqToNoteName(target.freq, settings.diapason) ? sounding : null,
      displayCents: getCents(pitch, target.freq),
      activeStringId: target.id,
      activeFreq: target.freq,
    }
  }, [chromatic, lockedStringId, pitch, strings, settings.diapason])

  // One latched in-tune verdict for the whole app: the bar, the headstock ring and
  // the beep all read this, so they can never contradict each other.
  const [inTune, setInTune] = useState(false)
  useEffect(() => {
    if (!displayNote) {
      setInTune(false)
      return
    }
    const off = Math.abs(displayCents)
    const exit = off <= settings.inTuneThreshold + HYSTERESIS_CENTS
    // Right after a pluck the reading glides down from the sharp attack, and a
    // string that is flat passes through the zone on its way: it must not flash
    // green (or start the beep's dwell) on the way through. A string already in
    // tune is not knocked out by a gentle re-pluck either.
    setInTune(prev => (prev ? exit : !settling && off <= settings.inTuneThreshold))
  }, [displayNote, displayCents, settling, settings.inTuneThreshold])

  // The green band has to be drawn at whatever width the verdict is currently using,
  // hysteresis included. Drawing it at the entry width while the latch holds until
  // the exit width puts the dot visibly outside a band that says IN TUNE — at the
  // default ±3 the slack is two thirds of the band's half-width, so the dot clears
  // it entirely.
  const zoneCents = inTune ? settings.inTuneThreshold + HYSTERESIS_CENTS : settings.inTuneThreshold

  // A timer rather than a per-render dwell check. Polling `Date.now()` on every
  // render only worked because the old detector pushed a new reading 60 times a
  // second; a parked string now stops publishing entirely, so there would be no
  // render left to poll on. The cleanup also means the dwell restarts by itself
  // whenever the string, the note or the in-tune verdict changes — a string that
  // was already in tune no longer hands its elapsed time to the next one.
  // Read through a ref: as a dependency, marking a string tuned would restart the
  // dwell timer and beep again 900 ms later.
  const tunedRef = useRef(tunedStrings)
  useEffect(() => { tunedRef.current = tunedStrings }, [tunedStrings])

  useEffect(() => {
    // While the reference tone is held the mic is hearing the app, not the string:
    // that must not beep or mark anything tuned.
    if (!inTune || !displayNote || refHeld) return
    const id = setTimeout(() => {
      beep()
      navigator.vibrate?.(TUNED_VIBRATE)
      // Chromatic has no strings to mark
      const active = strings.find(s => s.id === activeStringId)
      if (!active) return
      // Mark all same-frequency strings as tuned (covers unison pairs like B3/B3')
      const companions = strings.filter(s => Math.abs(s.freq - active.freq) < 0.01).map(s => s.id)
      if (!tunedRef.current.has(activeStringId)) {
        const tuned = new Set([...tunedRef.current, ...companions])
        const flash = {
          stringId: activeStringId,
          label: tuned.size === strings.length ? 'All strings' : active.label,
          key: Date.now(),
        }
        // Guided tuning: with a string locked, the lock moves on to the next one
        // not yet tuned (lowest first, wrapping) once the flash has played, and
        // lets go when there is none left.
        if (lockedStringId !== null) {
          const i = strings.findIndex(s => s.id === activeStringId)
          const next = [...strings.slice(i + 1), ...strings.slice(0, i)].find(s => !tuned.has(s.id))
          flash.advanceTo = next?.id ?? null
        }
        setTunedFlash(flash)
      }
      setTunedStrings(prev => { const next = new Set(prev); companions.forEach(cid => next.add(cid)); return next })
    }, IN_TUNE_BEEP_MS)
    return () => clearTimeout(id)
  }, [inTune, displayNote, activeStringId, lockedStringId, beep, strings, refHeld])

  useEffect(() => {
    if (!tunedFlash) return
    const id = setTimeout(() => {
      setTunedFlash(null)
      // Only if the user has not moved the lock themselves in the meantime
      if ('advanceTo' in tunedFlash) {
        setLockedStringId(prev => (prev === tunedFlash.stringId ? tunedFlash.advanceTo : prev))
      }
    }, TUNED_FLASH_MS)
    return () => clearTimeout(id)
  }, [tunedFlash])

  // The reading's colour, for the headstock. It changes only when the reading
  // crosses zero or settles, so the memoized headstock still skips nearly every
  // reading.
  const signal = !displayNote ? null : inTune ? 'emerald' : settling ? 'zinc' : displayCents > 0 ? 'amber' : 'sky'
  // Which way to turn the peg — only once the reading has settled and says which
  const turn = signal === 'amber' ? 'down' : signal === 'sky' ? 'up' : null

  const tuning = instrumentData.tunings[safeTuningKey]
  // "Standard · EADGBE": for a 12-string, one letter per course
  const subtitle = view === 'chords'
    ? `Chords · ${chromatic ? 'Guitar' : instrumentData.label}`
    : chromatic
      ? `Chromatic · A4 = ${settings.diapason} Hz`
      : `${tuning.label.split('(')[0].trim()} · ${(strings.length === 12 ? strings.filter((_, j) => j % 2 === 0) : strings)
        .map(s => s.note.replace('#', '♯')).join('')}`
  const lockedLabel = lockedStringId !== null ? strings.find(s => s.id === lockedStringId)?.label ?? null : null


  const showTuned = isListening && tunedStrings.size > 0

  return (
    <div className="relative min-h-screen bg-canvas text-ink flex flex-col transition-colors duration-200">
      {/* A faint teal wash from the top — atmosphere, not chrome */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 45% at 50% -10%, rgba(42,171,158,0.10), transparent 60%)' }}
      />
      <div className="relative flex-1 flex flex-col w-full max-w-lg mx-auto">
        <header className="relative z-40 flex items-center justify-center px-5 pb-2.5 pt-[calc(16px+env(safe-area-inset-top))] min-h-[66px]">
          <div className="flex items-center gap-2.5">
            <AppLogo size={30} />
            <div className="flex flex-col gap-[3px]">
              <h1 className="text-base font-semibold tracking-[-0.02em] leading-none whitespace-nowrap" aria-label="Easy Guitar Tuner">
                Easy<span className="text-brand">Guitar</span>Tuner
              </h1>
              <span className="font-mono text-[11px] text-muted leading-none whitespace-nowrap">{subtitle}</span>
            </div>
          </div>
          <div className="absolute right-5 bottom-2.5">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
              aria-haspopup="dialog"
              className="w-10 h-10 rounded-xl border border-line bg-surface text-ink-2 hover:text-ink flex items-center justify-center transition-colors cursor-pointer"
            >
              <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 9h16M4 15h16" /></svg>
            </button>
          </div>
        </header>

        {view === 'chords' ? (
          <main className="relative flex-1 flex flex-col gap-3.5 px-4 pt-3.5 pb-4">
            <ChordsView
              instrument={instrument}
              diapason={settings.diapason}
              dark={dark}
              playChord={playChord}
              root={chordRoot}
              suffix={chordSuffix}
              onRootChange={setChordRoot}
              onSuffixChange={setChordSuffix}
              lefty={lefty}
            />
          </main>
        ) : (
          <main className="relative flex flex-col gap-3.5 px-4 pt-3.5">
            {/* One control row: mic, auto/lock, and the detection preset — one tap
                to compare two configurations mid-session */}
            <div className="flex items-center justify-center gap-3 min-h-[60px]">
              <MicButton listening={isListening} onStart={start} onStop={handleStop} />
              {!chromatic && (
                <AutoToggle
                  lockedStringId={lockedStringId}
                  activeStringId={activeStringId}
                  strings={strings}
                  onToggle={handleLockToggle}
                />
              )}
              <PresetSelector
                presets={preset.presets}
                activeId={preset.activeId}
                active={preset.active}
                dirty={preset.dirty}
                suggestedName={preset.suggestedName}
                onSelect={preset.selectPreset}
                onSave={preset.saveActive}
                onSaveAs={preset.saveAs}
                onRevert={preset.revert}
              />
            </div>
            {error && (
              <p className="-mt-1 text-center text-xs text-red-500 dark:text-red-400 leading-snug">
                {error === 'Microphone access denied.'
                  ? 'Mic access denied. Allow it in browser settings and try again.'
                  : <>{error}{' '}<button onClick={() => window.location.reload()} className="underline underline-offset-2 cursor-pointer">Reload the page</button></>}
              </p>
            )}

            {/* One tuner card: readout on top, headstock below */}
            <div
              className="relative flex flex-col overflow-hidden rounded-[28px] border"
              style={{
                background: 'linear-gradient(to bottom, var(--panel-from), var(--bg))',
                borderColor: 'var(--panel-line)',
                boxShadow: 'var(--panel-inset)',
              }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 transition-opacity duration-300"
                style={{ background: 'radial-gradient(90% 40% at 50% 0%, rgba(16,185,129,0.14), transparent 70%)', opacity: inTune ? 1 : 0 }}
              />
              <div className="relative px-5 pt-4 pb-1 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-3 h-6">
                  <span className="flex items-center gap-2 min-w-0 text-sm font-medium text-ink-2 whitespace-nowrap">
                    <span className="w-2 h-2 shrink-0 rounded-full" style={{ background: isListening ? '#10b981' : 'var(--note-idle)' }} />
                    <span className="truncate">{isListening ? `Listening · ${chromatic ? 'Chromatic' : lockedLabel ?? 'Auto'}` : 'Mic off'}</span>
                  </span>
                  <div
                    className="flex items-center gap-2 shrink-0 transition-opacity"
                    style={{ opacity: showTuned ? 1 : 0, pointerEvents: showTuned ? 'auto' : 'none' }}
                    aria-hidden={!showTuned}
                  >
                    {/* Twelve dots at full size do not fit beside the status on a phone */}
                    <div className={`flex ${strings.length > 6 ? 'gap-[3px]' : 'gap-[5px]'}`}>
                      {strings.map(s => (
                        <span key={s.id} className={`${strings.length > 6 ? 'w-[5px] h-[5px]' : 'w-[7px] h-[7px]'} rounded-full transition-colors duration-300`}
                          style={{ background: tunedStrings.has(s.id) ? '#10b981' : 'var(--btn-stroke)' }} />
                      ))}
                    </div>
                    <span className="font-mono text-sm text-ink-2 tabular-nums">{tunedStrings.size}/{strings.length}</span>
                    <button
                      onClick={resetTuned}
                      aria-label="Reset tuned strings"
                      title="Reset"
                      className="w-6 h-6 ml-0.5 rounded-full border border-line bg-surface text-ink-2 hover:text-ink flex items-center justify-center cursor-pointer"
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                    </button>
                  </div>
                </div>

                <TunerBar
                  listening={isListening}
                  cents={displayCents}
                  note={displayNote}
                  targetLabel={isListening ? lockedLabel?.replace(/[ʼˡ]/g, '') ?? null : null}
                  soundingNote={soundingNote}
                  settling={settling}
                  freq={pitch}
                  inTune={inTune}
                  zoneCents={zoneCents}
                  displaySmooth={settings.displaySmooth}
                  barRange={settings.barRange}
                  flashLabel={tunedFlash?.label ?? null}
                  idleHint={chromatic ? 'Play any note.' : undefined}
                />
                <InputLevel statsRef={statsRef} hasNote={displayNote !== null} active={isListening} />
                {settings.debugOverlay && isListening && <DebugOverlay statsRef={statsRef} />}
              </div>

              {!chromatic && <div className="relative flex justify-center px-2 pt-2 pb-1">
                <GuitarHeadstock
                  strings={strings}
                  activeStringId={activeStringId}
                  activeFreq={activeFreq}
                  lockedStringId={lockedStringId}
                  onStringSelect={handleLockToggle}
                  onPlay={playNote}
                  inTune={inTune}
                  signal={signal}
                  listening={isListening}
                  tunedStrings={tunedStrings}
                  flash={tunedFlash}
                  turn={turn}
                  mirrored={lefty}
                  onHoldStart={handleHoldStart}
                  onHoldEnd={handleHoldEnd}
                />
              </div>}
              {chromatic && <div className="h-4" />}
            </div>
          </main>
        )}

        <footer className="relative flex justify-center gap-3.5 pt-3.5 pb-[calc(20px+env(safe-area-inset-bottom))] text-xs text-faint whitespace-nowrap">
          <a href="https://www.sisqo.dev" target="_blank" rel="noopener noreferrer" className="hover:text-ink-2 transition-colors">by SisQo</a>
          <span>·</span>
          <a href="https://ko-fi.com/sisqo" target="_blank" rel="noopener noreferrer" className="text-[#72a4f2] hover:opacity-80 transition-opacity">Buy me a coffee</a>
          <span>·</span>
          <span className="font-mono">{__BUILD_HASH__}</span>
        </footer>
      </div>

      <MenuSheet
        open={menuOpen}
        onClose={closeMenu}
        dark={dark}
        onToggleTheme={() => setDark(d => !d)}
        onOpenSettings={() => setSettingsOpen(true)}
        showInstallOption={showInstallOption}
        onInstall={handleInstall}
        instrument={instrument}
        instruments={instrumentOptions}
        onInstrumentChange={handleInstrumentChange}
        tuningKey={safeTuningKey}
        tunings={instrumentData.tunings}
        onTuningChange={handleTuningChange}
        view={view}
        onViewChange={handleViewChange}
        onNewTuning={openNewTuning}
        onEditTuning={openEditTuning}
        lefty={lefty}
        onToggleLefty={() => setLefty(v => !v)}
      />

      {editor && (
        <TuningEditor
          key={editor.key}
          onClose={() => setEditor(null)}
          instrument={instrument}
          initial={editor.initial}
          editing={editor.id !== null}
          onSave={saveTuning}
          onDelete={deleteTuning}
          onPlay={playNote}
          diapason={settings.diapason}
        />
      )}

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={update}
        resetAll={handleResetAll}
        preset={preset}
      />

      <BottomSheet open={iosSheetOpen} onClose={closeIosSheet} label="Add to Home Screen">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold tracking-tight">Add to Home Screen</h2>
          <button
            onClick={closeIosSheet}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-well transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ol className="flex flex-col gap-4 px-1">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">1</span>
            <div className="flex-1">
              <p className="text-sm text-ink-2 leading-snug">
                Tap the <strong className="text-ink font-semibold">Share</strong> button in the Safari toolbar
              </p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-line">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span className="text-xs text-muted">Share</span>
              </div>
            </div>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">2</span>
            <p className="text-sm text-ink-2 leading-snug pt-0.5">
              Scroll down and tap <strong className="text-ink font-semibold">Add to Home Screen</strong>
            </p>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">3</span>
            <p className="text-sm text-ink-2 leading-snug pt-0.5">
              Tap <strong className="text-ink font-semibold">Add</strong> to confirm
            </p>
          </li>
        </ol>
        <p className="px-1 text-xs text-muted">Open this page in Safari if you don't see the Share button.</p>
      </BottomSheet>
    </div>
  )
}
