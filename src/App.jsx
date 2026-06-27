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
import InstrumentTabs from './components/InstrumentTabs'
import TuningSelector from './components/TuningSelector'
import TunerBar from './components/TunerBar'
import GuitarHeadstock from './components/GuitarHeadstock'
import MicButton from './components/MicButton'
import SettingsPanel from './components/SettingsPanel'

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
      className={`shrink-0 flex items-center gap-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
        isLocked
          ? 'bg-sky-50 border-sky-200 text-sky-700 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-300'
          : 'bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
      }`}
      style={{ fontSize: '12px', height: '34px' }}
    >
      {isLocked ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="font-semibold">{lockedString?.label ?? '—'}</span>
        </>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span>Auto</span>
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

  const { canInstall, isIOS, showInstallOption, install } = useInstallPrompt()

  const { settings, update, resetAll } = useSettings()

  // Keep a ref so the RAF loop in usePitchDetector always reads latest settings
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const { isListening, pitch, error, start, stop } = usePitchDetector(settingsRef)
  const { playNote } = useOscillator()
  const { beep } = useSuccessBeep()

  const inTuneStartRef = useRef(null)
  const beepFiredRef = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const allTunings = useMemo(() => getTunings(settings.diapason), [settings.diapason])
  const instrumentData = allTunings[instrument]
  const safeTuningKey = instrumentData.tunings[tuningKey] ? tuningKey : 'standard'
  const strings = instrumentData.tunings[safeTuningKey].strings

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
  const handleStop = useCallback(() => {
    stop()
    setTunedStrings(new Set())
  }, [stop])

  function handleInstall() {
    if (canInstall) {
      install()
    } else if (isIOS) {
      setIosSheetOpen(true)
    }
  }

  const { displayNote, displayCents, activeStringId, activeCents } = useMemo(() => {
    if (lockedStringId !== null) {
      const locked = strings.find(s => s.id === lockedStringId)
      const cents = locked && pitch ? getCents(pitch, locked.freq) : null
      return {
        displayNote: pitch ? freqToNoteName(pitch, settings.diapason) : null,
        displayCents: cents ?? 0,
        activeStringId: lockedStringId,
        activeCents: cents ?? 0,
      }
    }
    const closest = findClosestString(pitch, strings)
    return {
      displayNote: closest ? freqToNoteName(pitch, settings.diapason) : null,
      displayCents: closest?.cents ?? 0,
      activeStringId: closest?.id ?? null,
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
          setTunedStrings(prev => { const next = new Set(prev); next.add(activeStringId); return next })
        }
      }
    } else {
      inTuneStartRef.current = null
      beepFiredRef.current = false
    }
  }, [displayCents, displayNote, beep, settings.inTuneThreshold, activeStringId])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
      <header className="relative flex items-center justify-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="" className="w-10 h-10 rounded-xl" />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
              Easy<span style={{ color: '#2aab9e' }}>Guitar</span>Tuner
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 tracking-wide">Chromatic tuner</p>
          </div>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <HamburgerMenu
            dark={dark}
            onToggleTheme={() => setDark(d => !d)}
            onOpenSettings={() => setSettingsOpen(true)}
            showInstallOption={showInstallOption}
            onInstall={handleInstall}
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-3 px-4 py-3 max-w-lg mx-auto w-full">
        {/* Compact selector row + Auto toggle */}
        <div className="flex gap-2 items-center">
          <InstrumentTabs active={instrument} onChange={handleInstrumentChange} />
          <TuningSelector
            tunings={instrumentData.tunings}
            active={safeTuningKey}
            onChange={handleTuningChange}
          />
          <AutoToggle
            lockedStringId={lockedStringId}
            activeStringId={activeStringId}
            strings={strings}
            onToggle={handleLockToggle}
          />
        </div>

        {/* Mic button — primary action */}
        <div className="flex justify-center py-1">
          <MicButton listening={isListening} error={error} onStart={start} onStop={handleStop} />
        </div>

        {/* Tuner bar */}
        <div className="rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 px-5 py-4">
          {!isListening && !displayNote ? (
            <div className="flex flex-col items-center justify-center py-4 gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-zinc-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
              </svg>
              <p className="text-sm text-zinc-400 dark:text-zinc-600">Tap the mic button to start tuning</p>
            </div>
          ) : (
            <TunerBar
              cents={displayCents}
              note={displayNote}
              listening={isListening}
              inTuneThreshold={settings.inTuneThreshold}
              displaySmooth={settings.displaySmooth}
            />
          )}
        </div>

        {/* Headstock */}
        <GuitarHeadstock
          strings={strings}
          activeStringId={activeStringId}
          lockedStringId={lockedStringId}
          activeCents={activeCents}
          onStringSelect={handleLockToggle}
          onPlay={playNote}
          dark={dark}
          inTuneThreshold={settings.inTuneThreshold}
          tunedStrings={tunedStrings}
        />
      </main>

      <footer className="text-center text-xs text-zinc-400 dark:text-zinc-700 py-3">
        build {__BUILD_COMMITS__} · {__BUILD_HASH__}
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
