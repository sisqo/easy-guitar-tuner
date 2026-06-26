import { useMemo, useEffect } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { usePitchDetector } from './hooks/usePitchDetector'
import { useOscillator } from './hooks/useOscillator'
import { getTunings } from './data/tunings'
import { findClosestString, freqToNoteName, getCents } from './utils/noteUtils'
import ThemeToggle from './components/ThemeToggle'
import InstrumentTabs from './components/InstrumentTabs'
import TuningSelector from './components/TuningSelector'
import DiapasonControl from './components/DiapasonControl'
import TunerBar from './components/TunerBar'
import StringGrid from './components/StringGrid'
import MicButton from './components/MicButton'

export default function App() {
  const [dark, setDark] = useLocalStorage('egt-dark', true)
  const [instrument, setInstrument] = useLocalStorage('egt-instrument', 'guitar6')
  const [tuningKey, setTuningKey] = useLocalStorage('egt-tuning', 'standard')
  const [diapason, setDiapason] = useLocalStorage('egt-diapason', 440)

  const { isListening, pitch, error, start, stop } = usePitchDetector()
  const { playNote } = useOscillator()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const allTunings = useMemo(() => getTunings(diapason), [diapason])
  const instrumentData = allTunings[instrument]

  const safeTuningKey = instrumentData.tunings[tuningKey] ? tuningKey : 'standard'
  const currentTuning = instrumentData.tunings[safeTuningKey]
  const strings = currentTuning.strings

  const closest = useMemo(
    () => findClosestString(pitch, strings),
    [pitch, strings]
  )

  const displayNote = closest ? freqToNoteName(pitch, diapason) : null
  const displayCents = closest ? closest.cents : 0

  function handleInstrumentChange(id) {
    setInstrument(id)
    setTuningKey('standard')
  }

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
          <TunerBar cents={displayCents} note={displayNote} listening={isListening} />
          <div className="flex justify-center">
            <MicButton listening={isListening} error={error} onStart={start} onStop={stop} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <TuningSelector
            tunings={instrumentData.tunings}
            active={safeTuningKey}
            onChange={setTuningKey}
          />
          <DiapasonControl value={diapason} onChange={setDiapason} />
        </div>

        <StringGrid
          strings={strings}
          closestStringId={closest?.id ?? null}
          closestCents={closest?.cents ?? 0}
          onPlay={playNote}
        />
      </main>
    </div>
  )
}
