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
