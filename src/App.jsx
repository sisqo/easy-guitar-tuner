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
import DiapasonControl from './components/DiapasonControl'
import TunerBar from './components/TunerBar'
import GuitarHeadstock from './components/GuitarHeadstock'
import MicButton from './components/MicButton'

export default function App() {
  const [dark, setDark] = useLocalStorage('egt-dark', true)
  const [instrument, setInstrument] = useLocalStorage('egt-instrument', 'guitar6')
  const [tuningKey, setTuningKey] = useLocalStorage('egt-tuning', 'standard')
  const [diapason, setDiapason] = useLocalStorage('egt-diapason', 440)
  const [lockedStringId, setLockedStringId] = useState(null)

  const { isListening, pitch, error, start, stop } = usePitchDetector()
  const { playNote } = useOscillator()
  const { beep } = useSuccessBeep()

  const inTuneStartRef = useRef(null)
  const beepFiredRef = useRef(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const allTunings = useMemo(() => getTunings(diapason), [diapason])
  const instrumentData = allTunings[instrument]
  const safeTuningKey = instrumentData.tunings[tuningKey] ? tuningKey : 'standard'
  const strings = instrumentData.tunings[safeTuningKey].strings

  // When instrument or tuning changes, clear the lock
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

  // Compute what to display on the tuner bar
  const { displayNote, displayCents, activeStringId, activeCents } = useMemo(() => {
    if (lockedStringId !== null) {
      const locked = strings.find(s => s.id === lockedStringId)
      const cents = locked && pitch ? getCents(pitch, locked.freq) : null
      return {
        displayNote: pitch ? freqToNoteName(pitch, diapason) : null,
        displayCents: cents ?? 0,
        activeStringId: lockedStringId,
        activeCents: cents ?? 0,
      }
    }
    const closest = findClosestString(pitch, strings)
    return {
      displayNote: closest ? freqToNoteName(pitch, diapason) : null,
      displayCents: closest?.cents ?? 0,
      activeStringId: closest?.id ?? null,
      activeCents: closest?.cents ?? 0,
    }
  }, [lockedStringId, pitch, strings, diapason])

  // Success beep: fire once when string stays in tune for 1.5 continuous seconds
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

  const lockedString = lockedStringId !== null ? strings.find(s => s.id === lockedStringId) : null

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div>
          <h1 className="text-base font-bold tracking-tight text-zinc-100">EasyGuitarTuner</h1>
          <p className="text-xs text-zinc-600">Chromatic tuner</p>
        </div>
        <ThemeToggle dark={dark} onToggle={() => setDark(d => !d)} />
      </header>

      <main className="flex-1 flex flex-col gap-5 px-4 py-5 max-w-lg mx-auto w-full">
        <InstrumentTabs active={instrument} onChange={handleInstrumentChange} />

        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-5">
          <TunerBar
            cents={displayCents}
            note={displayNote}
            listening={isListening}
            lockedString={lockedString}
          />
          <div className="flex justify-center">
            <MicButton listening={isListening} error={error} onStart={start} onStop={stop} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TuningSelector
            tunings={instrumentData.tunings}
            active={safeTuningKey}
            onChange={handleTuningChange}
          />
          <DiapasonControl value={diapason} onChange={setDiapason} />
        </div>

        <GuitarHeadstock
          strings={strings}
          activeStringId={activeStringId}
          lockedStringId={lockedStringId}
          activeCents={activeCents}
          onStringSelect={handleLockToggle}
          onPlay={playNote}
        />
      </main>
    </div>
  )
}
