import { noteFreq, noteToMidi, midiToNote } from '../utils/noteUtils.js'

function buildStrings(pairs, diapason) {
  return pairs.map(([note, octave, label], i) => ({
    id: i,
    label: label || `${note}${octave}`,
    note,
    octave,
    freq: noteFreq(note, octave, diapason),
  }))
}

export function getTunings(diapason = 440) {
  return {
    guitar6: {
      label: 'Guitar 6',
      tunings: {
        standard:    { label: 'Standard (EADGBe)',       strings: buildStrings([['E',2],['A',2],['D',3],['G',3],['B',3],['E',4]], diapason) },
        dropD:       { label: 'Drop D',                  strings: buildStrings([['D',2],['A',2],['D',3],['G',3],['B',3],['E',4]], diapason) },
        halfDown:    { label: 'Half Step Down (Eb)',      strings: buildStrings([['D#',2],['G#',2],['C#',3],['F#',3],['A#',3],['D#',4]], diapason) },
        fullDown:    { label: 'Full Step Down (D)',       strings: buildStrings([['D',2],['G',2],['C',3],['F',3],['A',3],['D',4]], diapason) },
        dropC:       { label: 'Drop C',                  strings: buildStrings([['C',2],['G',2],['C',3],['F',3],['A',3],['D',4]], diapason) },
        openG:       { label: 'Open G',                  strings: buildStrings([['D',2],['G',2],['D',3],['G',3],['B',3],['D',4]], diapason) },
        openD:       { label: 'Open D',                  strings: buildStrings([['D',2],['A',2],['D',3],['F#',3],['A',3],['D',4]], diapason) },
        dadgad:      { label: 'DADGAD',                  strings: buildStrings([['D',2],['A',2],['D',3],['G',3],['A',3],['D',4]], diapason) },
        dropCsharp:  { label: 'Drop C#',                 strings: buildStrings([['C#',2],['G#',2],['C#',3],['F#',3],['A#',3],['D#',4]], diapason) },
        openE:       { label: 'Open E',                  strings: buildStrings([['E',2],['B',2],['E',3],['G#',3],['B',3],['E',4]], diapason) },
        openA:       { label: 'Open A',                  strings: buildStrings([['E',2],['A',2],['E',3],['A',3],['C#',4],['E',4]], diapason) },
        openC:       { label: 'Open C',                  strings: buildStrings([['C',2],['G',2],['C',3],['G',3],['C',4],['E',4]], diapason) },
        // The four bass strings an octave up — the high strings of a 12-string set.
        // Still thickest-slot first, so G4 sits above B3 in the list.
        nashville:   { label: 'Nashville',               strings: buildStrings([['E',3],['A',3],['D',4],['G',4],['B',3],['E',4]], diapason) },
      },
    },

    guitar12: {
      label: 'Guitar 12',
      tunings: {
        standard:  { label: 'Standard 12-string', strings: buildStrings([
          ['E',2,'E2'], ['E',3,'E3'],
          ['A',2,'A2'], ['A',3,'A3'],
          ['D',3,'D3'], ['D',4,'D4'],
          ['G',3,'G3'], ['G',4,'G4'],
          ['B',3,'B3'], ['B',3,'B3ʼ'],
          ['E',4,'E4'], ['E',4,'E4ʼ'],
        ], diapason) },
        dropD:   { label: 'Drop D 12-string', strings: buildStrings([
          ['D',2,'D2'], ['D',3,'D3ˡ'],
          ['A',2,'A2'], ['A',3,'A3'],
          ['D',3,'D3'], ['D',4,'D4'],
          ['G',3,'G3'], ['G',4,'G4'],
          ['B',3,'B3'], ['B',3,'B3ʼ'],
          ['E',4,'E4'], ['E',4,'E4ʼ'],
        ], diapason) },
        halfDown: { label: 'Half Step Down', strings: buildStrings([
          ['D#',2,'Eb2'], ['D#',3,'Eb3'],
          ['G#',2,'Ab2'], ['G#',3,'Ab3'],
          ['C#',3,'Db3'], ['C#',4,'Db4'],
          ['F#',3,'Gb3'], ['F#',4,'Gb4'],
          ['A#',3,'Bb3'], ['A#',3,'Bb3ʼ'],
          ['D#',4,'Eb4'], ['D#',4,'Eb4ʼ'],
        ], diapason) },
      },
    },

    ukulele: {
      label: 'Ukulele',
      tunings: {
        standard: { label: 'Standard (GCEA)',     strings: buildStrings([['G',4],['C',4],['E',4],['A',4]], diapason) },
        baritone: { label: 'Baritone (DGBE)',      strings: buildStrings([['D',3],['G',3],['B',3],['E',4]], diapason) },
        lowG:     { label: 'Low G (gCEA)',         strings: buildStrings([['G',3],['C',4],['E',4],['A',4]], diapason) },
        dTuning:  { label: 'D Tuning (ADF#B)',     strings: buildStrings([['A',4],['D',4],['F#',4],['B',4]], diapason) },
      },
    },

    // No strings: the target is whatever note is nearest the reading (App.jsx).
    // An empty list also turns off the tracker's octave correction, which only
    // ever snaps onto a string.
    chromatic: {
      label: 'Chromatic',
      chromatic: true,
      tunings: {
        standard: { label: 'Chromatic', strings: [] },
      },
    },
  }
}

// ── Custom tunings ────────────────────────────────────────────────────────────
// Stored as one MIDI number per slot, lowest string first. A 12-string is edited
// by course: the four bass courses get their octave string, the two treble
// courses a unison one, as on a standard 12-string.

// C2..D#5: inside the detector's 60–660 Hz with room for a string 50 cents out.
// B1 (61.7 Hz) flat would fall under MIN_FREQ, and nothing below C2 has been benched.
export const CUSTOM_MIDI_MIN = 36
export const CUSTOM_MIDI_MAX = 75
const OCTAVE_COURSES = 4

export const customSlotCount = (instrument) => ({ guitar6: 6, guitar12: 6, ukulele: 4 })[instrument] ?? 0

// The highest note a slot can take: a 12-string bass course needs room for its octave
export const customSlotMax = (instrument, i) =>
  instrument === 'guitar12' && i < OCTAVE_COURSES ? CUSTOM_MIDI_MAX - 12 : CUSTOM_MIDI_MAX

export const customTuningKey = (id) => `custom:${id}`
export const isCustomTuningKey = (key) => typeof key === 'string' && key.startsWith('custom:')

// Slot MIDI numbers from a built-in or custom tuning's strings — the editor's starting point
export function tuningToSlots(instrument, strings) {
  const picked = instrument === 'guitar12' ? strings.filter((_, j) => j % 2 === 0) : strings
  return picked.map(s => noteToMidi(s.note, s.octave))
}

export function buildCustomTuning(instrument, { name, notes }, diapason = 440) {
  const pairs = []
  notes.forEach((midi, i) => {
    const { note, octave } = midiToNote(midi)
    if (instrument !== 'guitar12') { pairs.push([note, octave]); return }
    if (i < OCTAVE_COURSES) {
      const hi = midiToNote(midi + 12)
      // An octave string that shares its name with another course (D2 + D3 next
      // to the D3 course) gets the ˡ mark, as in the built-in Drop D 12-string
      const clash = notes.some((m, j) => j !== i && m === midi + 12)
      pairs.push([note, octave], [hi.note, hi.octave, clash ? `${hi.note}${hi.octave}ˡ` : undefined])
    } else {
      pairs.push([note, octave], [note, octave, `${note}${octave}ʼ`])
    }
  })
  return { label: name, custom: true, strings: buildStrings(pairs, diapason) }
}
