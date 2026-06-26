import { noteFreq } from '../utils/noteUtils'

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
        halfDown:    { label: 'Half Step Down (Eb)',      strings: buildStrings([['D#',1],['G#',2],['C#',3],['F#',3],['A#',3],['D#',4]], diapason) },
        fullDown:    { label: 'Full Step Down (D)',       strings: buildStrings([['D',2],['G',2],['C',3],['F',3],['A',3],['D',4]], diapason) },
        dropC:       { label: 'Drop C',                  strings: buildStrings([['C',2],['G',2],['C',3],['F',3],['A',3],['D',4]], diapason) },
        openG:       { label: 'Open G',                  strings: buildStrings([['D',2],['G',2],['D',3],['G',3],['B',3],['D',4]], diapason) },
        openD:       { label: 'Open D',                  strings: buildStrings([['D',2],['A',2],['D',3],['F#',3],['A',3],['D',4]], diapason) },
        dadgad:      { label: 'DADGAD',                  strings: buildStrings([['D',2],['A',2],['D',3],['G',3],['A',3],['D',4]], diapason) },
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
          ['D',2,'D2'], ['D',3,'D3'],
          ['A',2,'A2'], ['A',3,'A3'],
          ['D',3,'D3'], ['D',4,'D4'],
          ['G',3,'G3'], ['G',4,'G4'],
          ['B',3,'B3'], ['B',3,'B3ʼ'],
          ['E',4,'E4'], ['E',4,'E4ʼ'],
        ], diapason) },
        halfDown: { label: 'Half Step Down', strings: buildStrings([
          ['D#',1,'Eb1'], ['D#',2,'Eb2'],
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
  }
}
