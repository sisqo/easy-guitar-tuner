const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function noteToMidi(note, octave) {
  const idx = NOTE_NAMES.indexOf(note)
  return (octave + 1) * 12 + idx
}

export function midiToFreq(midi, diapason = 440) {
  return diapason * Math.pow(2, (midi - 69) / 12)
}

export function noteFreq(note, octave, diapason = 440) {
  return midiToFreq(noteToMidi(note, octave), diapason)
}

export function freqToNoteName(freq, diapason = 440) {
  if (!freq || freq <= 0) return null
  const midi = Math.round(69 + 12 * Math.log2(freq / diapason))
  const note = NOTE_NAMES[((midi % 12) + 12) % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${note}${octave}`
}

export function getCents(detectedFreq, targetFreq) {
  if (!detectedFreq || !targetFreq) return 0
  return 1200 * Math.log2(detectedFreq / targetFreq)
}

export function findClosestString(frequency, strings) {
  if (!frequency) return null
  let minAbsCents = Infinity
  let closest = null
  for (const s of strings) {
    const cents = getCents(frequency, s.freq)
    if (Math.abs(cents) < minAbsCents) {
      minAbsCents = Math.abs(cents)
      closest = { ...s, cents }
    }
  }
  return closest
}

export function isInTune(cents, threshold = 5) {
  return Math.abs(cents) <= threshold
}
