// Detection and display parameters, kept as plain data (no React) so the tuning
// values are importable by scripts/tracker-check.mjs as well as by the app.

export const SETTINGS_VERSION = 4

export const SETTINGS_DEFAULTS = {
  // Tuning
  diapason:          440,   // A4 reference, Hz

  // Display
  inTuneThreshold:   3,     // green zone half-width, cents
  barRange:          25,    // bar full scale, ± cents
  displaySmooth:     0.22,  // needle glide only

  // Signal chain
  windowSize:        8192,  // analyser fftSize — samples per analysis
  hpFreq:            55,    // highpass, Hz — handling rumble and DC
  lpFreq:            1200,  // lowpass, Hz — partials that cause octave errors
  noiseGate:         0.001, // absolute RMS floor, after the filters; the adaptive gate sits above it
  clarityThreshold:  0.55,  // NSDF height needed to start a new note
  clarityTrack:      0.45,  // NSDF height needed to keep following the current note
  mpmK:              0.90,  // McLeod's period-selection k (octave control)

  // Tracking
  smoothFactor:      0.18,  // EMA alpha at 60 fps, while the pitch is parked
  smoothFactorFast:  0.45,  // EMA alpha while the pitch is travelling
  fastGateCents:     12,    // above this much movement, use the fast alpha
  rejectThreshold:   45,    // outlier gate, cents
  confirmFrames:     3,     // agreeing readings needed to accept a new note
  holdMs:            1200,  // how long a note survives silence

  debugOverlay:      false,

  _v:                SETTINGS_VERSION,
}

// Reset on a version bump. Detection and display parameters are ours to retune;
// `diapason` is the user's own preference and is always preserved.
export const MIGRATED_KEYS = [
  'inTuneThreshold', 'barRange', 'displaySmooth',
  'windowSize', 'hpFreq', 'lpFreq', 'noiseGate', 'clarityThreshold', 'clarityTrack', 'mpmK',
  'smoothFactor', 'smoothFactorFast', 'fastGateCents', 'rejectThreshold',
  'confirmFrames', 'holdMs',
]

// Removed settings, deleted from stored preferences on migration.
export const RETIRED_KEYS = ['resetThreshold']

// ── Presets ────────────────────────────────────────────────────────────────
//
// A preset is a named snapshot of the detection and display parameters, so a
// session with the guitar in hand can compare "more aggressive" against "more
// tolerant" by switching, instead of by remembering fourteen slider positions.

// What a preset captures — deliberately the same list a version bump resets,
// because both answer the same question: is this a parameter of ours to retune,
// or the user's own preference? `diapason` is theirs (a preset must never move
// somebody's A) and `debugOverlay` is a diagnostic switch, so neither travels.
export const PRESET_KEYS = MIGRATED_KEYS

// Presets are stored as *full* snapshots of PRESET_KEYS, never as a diff against
// the defaults: an experiment that felt right last month has to still mean the
// same thing after we retune a default. Keys added to SETTINGS_DEFAULTS after a
// preset was saved are filled in from the defaults on the read path.
export function presetValuesFrom(settings) {
  const values = {}
  for (const key of PRESET_KEYS) values[key] = settings[key]
  return values
}

// Built-ins are written as deltas from the defaults because that is what makes
// them readable and reviewable in source — but they are materialised into full
// snapshots here, so everything downstream handles one shape.
function builtin(id, label, description, overrides) {
  return {
    id,
    label,
    description,
    builtin: true,
    values: { ...presetValuesFrom(SETTINGS_DEFAULTS), ...overrides },
  }
}

export const BUILTIN_PRESETS = [
  builtin('standard', 'Standard', 'The tuned defaults', {}),

  // Answers sooner and follows a turning peg harder, and pays for it in steadiness:
  // a shorter window (halved latency), less evidence demanded before a note appears,
  // one fewer confirmation, faster smoothing either side of a lower movement gate.
  builtin('reactive', 'Reactive', 'Answers fast, jitters more', {
    windowSize:        4096,
    clarityThreshold:  0.46,
    clarityTrack:      0.38,
    smoothFactor:      0.30,
    smoothFactorFast:  0.60,
    fastGateCents:     8,
    confirmFrames:     2,
    holdMs:            800,
  }),

  // The other end: more evidence before anything is shown or replaced, slower
  // smoothing, a longer hold through the decay, and a green zone wide enough that
  // the reading settles inside it instead of hunting across it.
  builtin('steady', 'Steady', 'Slower, rock solid', {
    inTuneThreshold:   5,
    clarityThreshold:  0.66,
    clarityTrack:      0.52,
    smoothFactor:      0.11,
    smoothFactorFast:  0.32,
    fastGateCents:     16,
    rejectThreshold:   35,
    confirmFrames:     4,
    holdMs:            1800,
  }),

  // For a room that is not quiet: a higher absolute floor, filters closed in around
  // the strings themselves, a stricter k so hum partials cannot win the period, and
  // enough clarity demanded that noise never reads as a note.
  builtin('noisy', 'Noisy room', 'Rejects background noise', {
    hpFreq:            75,
    lpFreq:            900,
    noiseGate:         0.0045,
    clarityThreshold:  0.68,
    clarityTrack:      0.52,
    mpmK:              0.93,
    confirmFrames:     4,
    holdMs:            1000,
  }),
]

export const DEFAULT_PRESET_ID = 'standard'
