// Lazy-loaded chord database (guitar + ukulele) from @tombatossals/chords-db.
// The JSON files are ~220 KB each, so they are dynamic-imported only when the
// Chords view is first opened — keeping the tuner's initial load lean.

const cache = {}

export function chordFamily(instrument) {
  return instrument === 'ukulele' ? 'ukulele' : 'guitar'
}

export async function loadChordDb(family) {
  if (cache[family]) return cache[family]
  const mod = family === 'ukulele'
    ? await import('@tombatossals/chords-db/lib/ukulele.json')
    : await import('@tombatossals/chords-db/lib/guitar.json')
  cache[family] = mod.default ?? mod
  return cache[family]
}

// Display root ("C#") -> chords-db object key ("Csharp"). Ukulele uses flats
// (Db, Gb…) which have no "#", so this is a no-op there.
const toObjKey = (root) => root.replace('#', 'sharp')

export const getRoots = (db) => db.keys

export const getChordsForRoot = (db, root) => db.chords[toObjKey(root)] ?? []

export const getSuffixes = (db, root) => getChordsForRoot(db, root).map((c) => c.suffix)

export const getChord = (db, root, suffix) =>
  getChordsForRoot(db, root).find((c) => c.suffix === suffix) ?? null

// Standard chord name: C / Cm / Cmaj7 / C7 …
export function chordName(root, suffix) {
  if (suffix === 'major') return root
  if (suffix === 'minor') return `${root}m`
  return `${root}${suffix}`
}

const SUFFIX_LABELS = {
  major: 'Major', minor: 'Minor', dim: 'Diminished', dim7: 'Dim 7', aug: 'Augmented',
  sus2: 'Sus2', sus4: 'Sus4', '7sus4': '7 Sus4', '6': 'Sixth', '69': '6/9',
  '7': 'Dominant 7', '7b5': '7♭5', '9': 'Ninth', '11': 'Eleventh', '13': 'Thirteenth',
  maj7: 'Major 7', maj9: 'Major 9', maj11: 'Major 11', maj13: 'Major 13',
  m6: 'Minor 6', m7: 'Minor 7', m7b5: 'Half-dim (m7♭5)', m9: 'Minor 9', m11: 'Minor 11',
  mmaj7: 'Minor-major 7', add9: 'Add 9', madd9: 'Minor add 9', alt: 'Altered',
}
export const suffixLabel = (suffix) => SUFFIX_LABELS[suffix] ?? suffix

const PITCH_CLASS = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
}
export const rootPitchClass = (root) => (root in PITCH_CLASS ? PITCH_CLASS[root] : null)

// String indices whose sounded note is the chord root — for accenting the root
// dots. midi[] lists only the non-muted strings, in string order, so we walk
// the frets and consume midi as we pass each played string.
export function rootStringSet(position, rootPc) {
  const set = new Set()
  if (rootPc == null || !position?.midi) return set
  let k = 0
  position.frets.forEach((f, i) => {
    if (f < 0) return // muted — not present in midi[]
    const m = position.midi[k++]
    if (m != null && (((m % 12) + 12) % 12) === rootPc) set.add(i)
  })
  return set
}
