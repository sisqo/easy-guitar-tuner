import { useMemo, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { usePitchDetector } from './hooks/usePitchDetector'
import { useOscillator } from './hooks/useOscillator'
import { useSuccessBeep } from './hooks/useSuccessBeep'
import { getTunings } from './data/tunings'
import { findClosestString, freqToNoteName, getCents, isInTune } from './utils/noteUtils'
import ThemeToggle from './components/ThemeToggle'
import InstrumentTabs from './components/InstrumentTabs'
import TuningSelector from './components/TuningSelector'
import TunerBar from './components/TunerBar'
import GuitarHeadstock from './components/GuitarHeadstock'
import MicButton from './components/MicButton'

const DIAPASON = 440

export default function App() {
  const [dark, setDark] = useLocalStorage('egt-dark', true)
  const [instrument, setInstrument] = useLocalStorage('egt-instrument', 'guitar6')
  const [tuningKey, setTuningKey] = useLocalStorage('egt-tuning', 'standard')
  const [lockedStringId, setLockedStringId] = useState(null)

  const { isListening, pitch, error, start, stop } = usePitchDetector()
  const { playNote } = useOscillator()
  const { beep } = useSuccessBeep()

  const inTuneStartRef = useRef(null)
  const beepFiredRef = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const allTunings = useMemo(() => getTunings(DIAPASON), [])
  const instrumentData = allTunings[instrument]
  const safeTuningKey = instrumentData.tunings[tuningKey] ? tuningKey : 'standard'
  const strings = instrumentData.tunings[safeTuningKey].strings

  function handleInstrumentChange(id) {
    setInstrument(id)
    setTuningKey('standard')
    setLockedStringId(null)
  }
  function handleTuningChange(key) {
    setTuningKey(key)
    setLockedStringId(null)
  }
  function handleLockToggle(stringId) {
    setLockedStringId(prev => prev === stringId ? null : stringId)
  }

  const { displayNote, displayCents, activeStringId, activeCents } = useMemo(() => {
    if (lockedStringId !== null) {
      const locked = strings.find(s => s.id === lockedStringId)
      const cents = locked && pitch ? getCents(pitch, locked.freq) : null
      return {
        displayNote: pitch ? freqToNoteName(pitch, DIAPASON) : null,
        displayCents: cents ?? 0,
        activeStringId: lockedStringId,
        activeCents: cents ?? 0,
      }
    }
    const closest = findClosestString(pitch, strings)
    return {
      displayNote: closest ? freqToNoteName(pitch, DIAPASON) : null,
      displayCents: closest?.cents ?? 0,
      activeStringId: closest?.id ?? null,
      activeCents: closest?.cents ?? 0,
    }
  }, [lockedStringId, pitch, strings])

  useEffect(() => {
    if (isInTune(displayCents, 5) && displayNote) {
      if (inTuneStartRef.current === null) {
        inTuneStartRef.current = Date.now()
      } else if (Date.now() - inTuneStartRef.current >= 1500 && !beepFiredRef.current) {
        beep()
        beepFiredRef.current = true
      }
    } else {
      inTuneStartRef.current = null
      beepFiredRef.current = false
    }
  }, [displayCents, displayNote, beep])

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col">
      <header className="relative flex items-center justify-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="" className="w-14 h-14 rounded-2xl" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-none">
              Easy<span style={{ color: '#2aab9e' }}>Guitar</span>Tuner
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 tracking-wide">Chromatic tuner</p>
          </div>
        </div>
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} />
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto w-full">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <InstrumentTabs active={instrument} onChange={handleInstrumentChange} />
          <div className="flex items-center justify-center" style={{ paddingBottom: '1px' }}>
            <MicButton listening={isListening} error={error} onStart={start} onStop={stop} />
          </div>
          <TuningSelector
            tunings={instrumentData.tunings}
            active={safeTuningKey}
            onChange={handleTuningChange}
          />
        </div>


        <div className="rounded-2xl bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 px-5 py-4">
          <TunerBar
            cents={displayCents}
            note={displayNote}
            listening={isListening}
          />
        </div>


        <GuitarHeadstock
          strings={strings}
          activeStringId={activeStringId}
          lockedStringId={lockedStringId}
          activeCents={activeCents}
          onStringSelect={handleLockToggle}
          onPlay={playNote}
          dark={dark}
        />
      </main>

      <footer className="text-center text-xs text-zinc-400 dark:text-zinc-700 py-3">
        build {__BUILD_COMMITS__} · {__BUILD_HASH__}
      </footer>
    </div>
  )
}
