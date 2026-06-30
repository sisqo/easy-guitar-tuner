import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { useSettings } from './hooks/useSettings'
import { usePitchDetector } from './hooks/usePitchDetector'
import { useOscillator } from './hooks/useOscillator'
import { useSuccessBeep } from './hooks/useSuccessBeep'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { getTunings } from './data/tunings'
import { findClosestString, freqToNoteName, getCents, isInTune } from './utils/noteUtils'
import HamburgerMenu from './components/HamburgerMenu'
import TunerBar from './components/TunerBar'
import GuitarHeadstock from './components/GuitarHeadstock'
import MicButton from './components/MicButton'
import SettingsPanel from './components/SettingsPanel'
import ChordsView from './components/ChordsView'

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
      className={`group relative rounded-full flex items-center gap-2 shrink-0 border transition-all duration-200 ease-out active:scale-[0.97] cursor-pointer ${
        isLocked
          ? 'h-11 px-4 font-semibold text-sm bg-gradient-to-b from-sky-50 to-sky-100 border-sky-200 text-sky-700 dark:from-sky-950/70 dark:to-sky-950/40 dark:border-sky-800/80 dark:text-sky-300'
          : 'h-9 px-3 font-medium text-xs border-zinc-200 text-zinc-400 dark:border-zinc-700 dark:text-zinc-600 hover:border-zinc-300 hover:text-zinc-500 dark:hover:border-zinc-600 dark:hover:text-zinc-500'
      }`}
    >
      {isLocked && (
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
      )}
      {isLocked ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="relative w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="relative">{lockedString?.label ?? '—'}</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70 shrink-0" />
          <span>Auto detect</span>
        </>
      )}
    </button>
  )
}

export default function App() {
  const [dark, setDark] = useLocalStorage('egt-dark', true)
  const [instrument, setInstrument] = useLocalStorage('egt-instrument', 'guitar6')
  const [tuningKey, setTuningKey] = useLocalStorage('egt-tuning', 'standard')
  const [lockedStringId, setLockedStringId] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tunedStrings, setTunedStrings] = useState(() => new Set())
  const [iosSheetOpen, setIosSheetOpen] = useState(false)
  // Chords section — view always opens on the tuner; chord selection persists for the session
  const [view, setView] = useState('tuner')
  const [chordRoot, setChordRoot] = useState('C')
  const [chordSuffix, setChordSuffix] = useState('major')

  const { canInstall, isIOS, showInstallOption, install } = useInstallPrompt()

  const { settings, update, resetAll } = useSettings()

  // Keep a ref so the RAF loop in usePitchDetector always reads latest settings
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const inTuneStartRef = useRef(null)
  const beepFiredRef = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const allTunings = useMemo(() => getTunings(settings.diapason), [settings.diapason])
  const instrumentData = allTunings[instrument]
  const safeTuningKey = instrumentData.tunings[tuningKey] ? tuningKey : 'standard'
  const strings = instrumentData.tunings[safeTuningKey].strings
  const instrumentOptions = useMemo(
    () => Object.entries(allTunings).map(([id, d]) => ({ id, label: d.label })),
    [allTunings],
  )

  // Keep a ref so the RAF loop can do string-aware octave correction without restart
  const stringsRef = useRef(strings)
  useEffect(() => { stringsRef.current = strings }, [strings])

  const { isListening, pitch, error, start, stop } = usePitchDetector(settingsRef, stringsRef)
  const { playNote, playChord } = useOscillator()
  const { beep } = useSuccessBeep()

  const handleStop = useCallback(() => {
    stop()
    setTunedStrings(new Set())
  }, [stop])

  // Switching to Chords stops the mic (you're not tuning) to save battery
  const handleViewChange = useCallback((v) => {
    setView(v)
    if (v === 'chords' && isListening) handleStop()
  }, [isListening, handleStop])

  function handleInstrumentChange(id) {
    setInstrument(id)
    setTuningKey('standard')
    setLockedStringId(null)
    setTunedStrings(new Set())
  }
  function handleTuningChange(key) {
    setTuningKey(key)
    setLockedStringId(null)
    setTunedStrings(new Set())
  }
  function handleLockToggle(stringId) {
    setLockedStringId(prev => prev === stringId ? null : stringId)
  }

  function handleInstall() {
    if (canInstall) {
      install()
    } else if (isIOS) {
      setIosSheetOpen(true)
    }
  }

  const { displayNote, displayCents, activeStringId, activeFreq, activeCents } = useMemo(() => {
    if (lockedStringId !== null) {
      const locked = strings.find(s => s.id === lockedStringId)
      const cents = locked && pitch ? getCents(pitch, locked.freq) : null
      return {
        displayNote: pitch ? freqToNoteName(pitch, settings.diapason) : null,
        displayCents: cents ?? 0,
        activeStringId: lockedStringId,
        activeFreq: locked?.freq ?? null,
        activeCents: cents ?? 0,
      }
    }
    const closest = findClosestString(pitch, strings)
    return {
      displayNote: closest ? freqToNoteName(pitch, settings.diapason) : null,
      displayCents: closest?.cents ?? 0,
      activeStringId: closest?.id ?? null,
      activeFreq: closest?.freq ?? null,
      activeCents: closest?.cents ?? 0,
    }
  }, [lockedStringId, pitch, strings, settings.diapason])

  useEffect(() => {
    if (isInTune(displayCents, settings.inTuneThreshold) && displayNote) {
      if (inTuneStartRef.current === null) {
        inTuneStartRef.current = Date.now()
      } else if (Date.now() - inTuneStartRef.current >= 1500 && !beepFiredRef.current) {
        beep()
        beepFiredRef.current = true
        if (activeStringId !== null) {
          // Mark all same-frequency strings as tuned (covers unison pairs like B3/B3')
          const aFreq = strings.find(s => s.id === activeStringId)?.freq
          const companions = strings.filter(s => aFreq != null && Math.abs(s.freq - aFreq) < 0.01).map(s => s.id)
          setTunedStrings(prev => { const next = new Set(prev); companions.forEach(id => next.add(id)); return next })
        }
      }
    } else {
      inTuneStartRef.current = null
      beepFiredRef.current = false
    }
  }, [displayCents, displayNote, beep, settings.inTuneThreshold, activeStringId])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
      {/* Ambient stage-light wash from the top — atmosphere, not chrome */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: dark
            ? 'radial-gradient(115% 50% at 50% -8%, rgba(255,255,255,0.05), transparent 60%)'
            : 'radial-gradient(115% 50% at 50% -8%, rgba(255,255,255,0.7), transparent 55%)',
        }}
      />
      <header className="relative z-20 flex items-center justify-center px-4 py-3">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
              Easy<span style={{ color: '#2aab9e' }}>Guitar</span>Tuner
            </h1>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 tracking-wide">
              {instrumentData.label} · {instrumentData.tunings[safeTuningKey].label.split('(')[0].trim()}
            </p>
          </div>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <HamburgerMenu
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
          />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col gap-3 px-4 py-3 max-w-lg mx-auto w-full">
        {view === 'chords' ? (
          <ChordsView
            instrument={instrument}
            diapason={settings.diapason}
            dark={dark}
            playChord={playChord}
            root={chordRoot}
            suffix={chordSuffix}
            onRootChange={setChordRoot}
            onSuffixChange={setChordSuffix}
          />
        ) : (
        <>
        {/* Primary controls — mic + auto, side by side and harmonised */}
        <div className="flex items-center justify-center gap-3 py-1">
          <MicButton listening={isListening} onStart={start} onStop={handleStop} />
          <AutoToggle
            lockedStringId={lockedStringId}
            activeStringId={activeStringId}
            strings={strings}
            onToggle={handleLockToggle}
          />
        </div>
        {error && (
          <p className="-mt-1 text-center text-xs text-red-500 dark:text-red-400 leading-snug">
            {error === 'Microphone access denied.'
              ? 'Mic access denied. Allow it in browser settings and try again.'
              : <>{error}{' '}<button onClick={() => window.location.reload()} className="underline underline-offset-2 cursor-pointer">Reload the page</button></>}
          </p>
        )}

        {/* One tuner panel: readout + headstock on a single blueprint grid */}
        <div
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
          style={{
            backgroundColor: dark ? '#09090b' : '#f4f4f5',
            backgroundImage: `linear-gradient(${dark ? 'rgba(255,255,255,0.05)' : 'rgba(24,24,32,0.05)'} 1px, transparent 1px), linear-gradient(90deg, ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(24,24,32,0.05)'} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        >
          <div className="px-5 pt-5 pb-2">
            {!isListening && !displayNote ? (
              <div className="flex flex-col items-center justify-center py-2 gap-1">
                <span className="text-6xl font-bold leading-none tabular-nums text-zinc-200 dark:text-zinc-800 select-none">–</span>
                <p className="text-sm text-zinc-400 dark:text-zinc-600 tracking-wide">Tap to start tuning</p>
              </div>
            ) : (
              <TunerBar
                cents={displayCents}
                note={displayNote}
                freq={pitch}
                listening={isListening}
                inTuneThreshold={settings.inTuneThreshold}
                displaySmooth={settings.displaySmooth}
              />
            )}
          </div>

          {isListening && tunedStrings.size > 0 && (
            <div className="px-5 pb-2 flex items-center gap-2">
              <div className="flex gap-1">
                {strings.map(s => (
                  <span
                    key={s.id}
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${tunedStrings.has(s.id) ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums">
                {tunedStrings.size}/{strings.length}
              </span>
            </div>
          )}

          <GuitarHeadstock
            strings={strings}
            activeStringId={activeStringId}
            activeFreq={activeFreq}
            lockedStringId={lockedStringId}
            activeCents={activeCents}
            onStringSelect={handleLockToggle}
            onPlay={playNote}
            dark={dark}
            inTuneThreshold={settings.inTuneThreshold}
            tunedStrings={tunedStrings}
          />
        </div>
        </>
        )}
      </main>

      <footer className="text-center text-sm text-zinc-500/80 dark:text-zinc-500/60 py-3 tracking-wide">
        by SisQo &nbsp;·&nbsp; <span className="font-mono">{__BUILD_HASH__}</span>
      </footer>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        update={update}
        resetAll={resetAll}
      />

      {iosSheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setIosSheetOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 rounded-t-2xl border-t border-zinc-200 dark:border-zinc-800 px-6 pt-5 pb-8 max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Add to Home Screen</h2>
              <button
                onClick={() => setIosSheetOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ol className="flex flex-col gap-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#2aab9e] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div className="flex-1">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
                    Tap the <strong className="text-zinc-900 dark:text-zinc-100">Share</strong> button in the Safari toolbar
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Share</span>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#2aab9e] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug pt-0.5">
                  Scroll down and tap <strong className="text-zinc-900 dark:text-zinc-100">Add to Home Screen</strong>
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#2aab9e] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug pt-0.5">
                  Tap <strong className="text-zinc-900 dark:text-zinc-100">Add</strong> to confirm
                </p>
              </li>
            </ol>
            <p className="mt-5 text-xs text-zinc-400 dark:text-zinc-600">
              Open this page in Safari if you don't see the Share button.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
