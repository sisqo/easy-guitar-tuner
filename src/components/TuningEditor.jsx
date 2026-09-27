import { useState } from 'react'
import BottomSheet from './BottomSheet'
import { CUSTOM_MIDI_MIN, customSlotMax } from '../data/tunings'
import { midiToNote, midiToFreq } from '../utils/noteUtils'

const NAME_MAX = 24

function Stepper({ label, midi, min, max, onChange, onPlay }) {
  const { note, octave } = midiToNote(midi)
  const btn = 'w-10 h-10 rounded-xl border border-line bg-card text-ink-2 hover:text-ink flex items-center justify-center cursor-pointer disabled:opacity-35 disabled:cursor-default'
  return (
    <div className="flex items-center gap-2">
      <span className="w-[62px] shrink-0 text-xs text-muted">{label}</span>
      <button className={btn} onClick={() => onChange(midi - 1)} disabled={midi <= min} aria-label={`${label} down a semitone`}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
      <button
        onClick={onPlay}
        aria-label={`Play ${note}${octave}`}
        className="flex-1 h-10 rounded-xl border border-line bg-well flex items-baseline justify-center gap-0.5 cursor-pointer"
      >
        <span className="text-lg font-medium leading-10 text-ink">{note.replace('#', '♯')}</span>
        <span className="font-mono text-xs text-muted">{octave}</span>
      </button>
      <button className={btn} onClick={() => onChange(midi + 1)} disabled={midi >= max} aria-label={`${label} up a semitone`}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  )
}

// Rendered only while open (App mounts it with a fresh `key`), so the draft
// starts from `initial` every time without an effect to sync it.
export default function TuningEditor({ onClose, instrument, initial, editing, onSave, onDelete, onPlay, diapason }) {
  const [name, setName] = useState(initial.name)
  const [notes, setNotes] = useState(initial.notes)
  const n = notes.length
  const unit = instrument === 'guitar12' ? 'Course' : 'String'
  const trimmed = name.trim()

  function setSlot(i, midi) {
    setNotes(prev => prev.map((m, j) => (j === i ? midi : m)))
  }

  return (
    <BottomSheet open onClose={onClose} label={editing ? 'Edit tuning' : 'New tuning'}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-semibold tracking-tight">{editing ? 'Edit tuning' : 'New tuning'}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-well transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <input
        value={name}
        onChange={e => setName(e.target.value.slice(0, NAME_MAX))}
        placeholder="Tuning name"
        aria-label="Tuning name"
        className="h-11 px-3.5 rounded-xl border border-line bg-card text-sm text-ink placeholder:text-faint outline-none focus:border-brand/60"
      />

      {/* Lowest string first, as on the headstock and in tunings.js; numbered the
          way players count them, thickest = highest number */}
      <div className="flex flex-col gap-2">
        {notes.map((midi, i) => (
          <Stepper
            key={i}
            label={`${unit} ${n - i}`}
            midi={midi}
            min={CUSTOM_MIDI_MIN}
            max={customSlotMax(instrument, i)}
            onChange={m => setSlot(i, m)}
            onPlay={() => onPlay(midiToFreq(midi, diapason))}
          />
        ))}
        {instrument === 'guitar12' && (
          <p className="text-xs text-muted leading-snug px-0.5">The four bass courses get an octave string, the two treble courses a unison one.</p>
        )}
      </div>

      <div className="flex gap-2">
        {editing && (
          <button
            onClick={onDelete}
            className="h-11 px-4 rounded-xl border border-line bg-card text-sm font-medium text-red-500 dark:text-red-400 cursor-pointer"
          >
            Delete
          </button>
        )}
        <button
          onClick={() => onSave({ name: trimmed, notes })}
          disabled={!trimmed}
          className="flex-1 h-11 rounded-xl bg-brand text-white text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-default"
        >
          Save
        </button>
      </div>
    </BottomSheet>
  )
}
