// Drives src/utils/pitchTracker.js with synthetic frame sequences.
//
// There is no test runner in this repo and this needs none: `node
// scripts/tracker-check.mjs` exercises the gate logic that was previously only
// observable with a guitar in hand. The step-change case is the regression test
// for the dead zone that used to strand the tracker on a stale note.

import { createTrackerState, trackPitch, resolveOctave, emaAlpha, cents } from '../src/utils/pitchTracker.js'
import { getTunings } from '../src/data/tunings.js'
import { SETTINGS_DEFAULTS } from '../src/data/settings.js'

const SIX = getTunings(440).guitar6.tunings.standard.strings
const TWELVE = getTunings(440).guitar12.tunings.standard.strings
const DROP_C = getTunings(440).guitar6.tunings.dropC.strings

const E2 = 82.41
const F2 = 87.31
const WINDOW_MS = 8192 / 48000 * 1000 // 170.7 ms
const STEP_MS = 30                    // ANALYSIS_INTERVAL_MS

let failures = 0
let checks = 0

function ok(name, condition, detail = '') {
  checks++
  if (condition) {
    console.log(`  \x1b[32mPASS\x1b[0m ${name}`)
  } else {
    failures++
    console.log(`  \x1b[31mFAIL\x1b[0m ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function near(actual, expected, tolCents, name) {
  const off = actual === null ? Infinity : Math.abs(cents(actual, expected))
  ok(name, off <= tolCents, `expected ~${expected.toFixed(2)} Hz, got ${actual === null ? 'null' : actual.toFixed(2)} (${off === Infinity ? 'null' : off.toFixed(1) + '¢'} off, tol ${tolCents}¢)`)
}

// Feed `count` frames of a fixed frequency. `hzAt` may be a function of index.
function feed(state, { hz, count, settings, strings, t0 = 0, clarity = 0.95, rms = 0.02, step = STEP_MS }) {
  const gates = []
  let now = t0
  for (let i = 0; i < count; i++) {
    now = t0 + i * step
    const rawHz = typeof hz === 'function' ? hz(i) : hz
    const r = trackPitch(state, { rawHz, clarity, rms, now, windowMs: WINDOW_MS }, settings, strings)
    gates.push(r.gate)
  }
  return { hz: state.smoothed, gates, endedAt: now }
}

const S = { ...SETTINGS_DEFAULTS }

console.log('\nresolveOctave — the ambiguity rules')
{
  near(resolveOctave(164.81, 82.41, TWELVE), 164.81, 1, '12-string E3 stays E3, not ÷2 to E2 (regression: f9ae016)')
  near(resolveOctave(164.82, 82.41, SIX), 82.41, 1, '6-string 2nd-harmonic reading folds back to E2')
  near(resolveOctave(110, 82.41, SIX), 110, 1, 'real string change to A2 is left alone')
  near(resolveOctave(329.63, 82.41, SIX), 329.63, 1, 'real string change to E4 is left alone')
  near(resolveOctave(75, 76, SIX), 75, 1, 'a low E sitting 160¢ flat is not doubled onto D3')
  near(resolveOctave(73.42, 74, SIX), 73.42, 1, 'a low E tuned down to D2 is not doubled onto D3')
  near(resolveOctave(73.42, null, SIX), 73.42, 1, 'cold start reports what was measured')
  near(resolveOctave(65.41, null, DROP_C), 65.41, 1, "Drop C's low C2 survives (regression: e8c6d26)")
}

console.log('\nemaAlpha — framerate independence')
{
  const a60 = emaAlpha(0.18, 1000 / 60)
  const a30 = emaAlpha(0.18, 1000 / 30)
  ok('alpha at 60 fps equals the configured value', Math.abs(a60 - 0.18) < 1e-9, `got ${a60}`)
  ok('alpha at 30 fps compensates (one 30 fps step ≈ two 60 fps steps)',
    Math.abs(a30 - (1 - 0.82 ** 2)) < 1e-9, `got ${a30}`)
}

console.log('\nsteady note')
{
  const st = createTrackerState()
  // ±3 cents of jitter around E2
  const r = feed(st, { hz: i => E2 * 2 ** ((i % 2 ? 3 : -3) / 1200), count: 40, settings: S, strings: SIX })
  near(r.hz, E2, 2, 'converges within 2¢ of E2')
  ok('no frame is rejected', r.gates.slice(1).every(g => g === 'ok'), `gates: ${[...new Set(r.gates)].join(',')}`)
}

console.log('\nsingle stray reading')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  const before = st.smoothed
  const r = trackPitch(st, { rawHz: 95, clarity: 0.95, rms: 0.02, now: 20 * STEP_MS, windowMs: WINDOW_MS }, S, SIX)
  ok('a lone off reading does not move the note', Math.abs(cents(st.smoothed, before)) < 0.01, `gate ${r.gate}`)
  ok('and is reported as an outlier', r.gate === 'outlier', `gate ${r.gate}`)
}

console.log('\nSTEP CHANGE — the dead-zone regression (E2 → F2, exactly 100¢)')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  const r = feed(st, { hz: F2, count: 40, settings: S, strings: SIX, t0: 20 * STEP_MS })
  near(r.hz, F2, 3, 'a sustained semitone step is followed')
  // How long until it committed: first non-pending/outlier gate after the step
  const settle = r.gates.findIndex(g => g === 'ok') * STEP_MS
  ok('and commits within ~1 window + confirmation', settle > 0 && settle <= 300, `settled after ${settle} ms`)
}

console.log('\nSTEP CHANGE at every distance — no unreachable band')
{
  // The old code silently discarded jumps in (rejectThreshold, resetThreshold].
  // Sweep the whole range and assert every one of them is followed.
  for (const jump of [50, 60, 75, 85, 95, 100, 110, 150, 200, 400, 700]) {
    const st = createTrackerState()
    feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
    const target = E2 * 2 ** (jump / 1200)
    const r = feed(st, { hz: target, count: 40, settings: S, strings: SIX, t0: 20 * STEP_MS })
    near(r.hz, target, 4, `${jump}¢ step is followed`)
  }
}

console.log('\nattack transient')
{
  const st = createTrackerState()
  // A hard pluck reads sharp for the first few frames; that used to become the
  // reference and strand every good frame that followed in the discard band.
  const r = feed(st, { hz: i => (i < 3 ? 88 : E2), count: 40, settings: S, strings: SIX })
  near(r.hz, E2, 3, 'settles on the true pitch, not the sharp attack')
}

console.log('\nscattered pending — must not stay stuck')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  const before = st.smoothed
  // Readings that never agree within CONFIRM_SPREAD_CENTS: no confirmation can
  // fire, so only the pending timeout can rescue this.
  const r = feed(st, {
    hz: i => 95 * 2 ** ((i % 3 === 0 ? 60 : i % 3 === 1 ? -60 : 0) / 1200),
    count: 30, settings: S, strings: SIX, t0: 20 * STEP_MS,
  })
  ok('the pending timeout breaks the deadlock',
    st.smoothed === null || Math.abs(cents(st.smoothed, before)) > 20,
    `still at ${st.smoothed === null ? 'null' : st.smoothed.toFixed(2)} (was ${before.toFixed(2)})`)
  ok('and it does not sit on "pending" forever',
    !r.gates.slice(-6).every(g => g === 'pending'), `tail gates: ${r.gates.slice(-6).join(',')}`)
}

console.log('\nhold expiry')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  ok('a note is held while the signal is present', st.smoothed !== null)
  // Silence: RMS below the gate.
  const r = feed(st, { hz: E2, count: 60, settings: S, strings: SIX, rms: 0, t0: 20 * STEP_MS })
  ok('and cleared once holdMs has passed in silence', r.hz === null, `hz ${r.hz}`)
  ok('the clearing frame reports why', r.gates.includes('hold'), `gates: ${[...new Set(r.gates)].join(',')}`)
}

console.log('\nhold is evaluated even while every frame is being discarded')
{
  // The precise old bug: clarity keeps passing, every frame is discarded, and the
  // hold check lived only in the failure branches so it never ran.
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  const strict = { ...S, confirmFrames: 6, rejectThreshold: 10 }
  const r = feed(st, {
    hz: i => 95 * 2 ** ((i % 2 ? 80 : -80) / 1200),
    count: 120, settings: strict, strings: SIX, t0: 20 * STEP_MS,
  })
  ok('the tracker does not stay pinned to the stale note',
    r.hz === null || Math.abs(cents(r.hz, E2)) > 20,
    `hz ${r.hz === null ? 'null' : r.hz.toFixed(2)}`)
}

console.log('\nconfirmation still wins over the backstop at the slowest settings')
{
  // confirmFrames 6 on a 16384-sample window needs ~850 ms to even collect the run.
  // A fixed 500 ms backstop would snap first and skip the spread check entirely, so
  // the timeout is derived from the run length.
  const slowWindow = (16384 / 48000) * 1000
  const st = createTrackerState()
  const slow = { ...S, confirmFrames: 6, windowSize: 16384 }
  const feedSlow = (hz, count, t0) => {
    let now = t0
    const gates = []
    for (let i = 0; i < count; i++) {
      now = t0 + i * STEP_MS
      gates.push(trackPitch(st, { rawHz: hz, clarity: 0.95, rms: 0.02, now, windowMs: slowWindow }, slow, SIX).gate)
    }
    return gates
  }
  feedSlow(E2, 30, 0)
  const target = E2 * 2 ** (500 / 1200)
  feedSlow(target, 60, 30 * STEP_MS)
  near(st.smoothed, target, 4, 'a 500¢ step is still followed with confirmFrames 6 and a 341 ms window')
  // And a run that never agrees must still escape, on the derived (longer) timeout.
  const st2 = createTrackerState()
  let now2 = 0
  for (let i = 0; i < 30; i++) { now2 = i * STEP_MS
    trackPitch(st2, { rawHz: E2, clarity: 0.95, rms: 0.02, now: now2, windowMs: slowWindow }, slow, SIX) }
  const was = st2.smoothed
  for (let i = 0; i < 120; i++) {
    const hz = 95 * 2 ** ((i % 3 === 0 ? 70 : i % 3 === 1 ? -70 : 0) / 1200)
    trackPitch(st2, { rawHz: hz, clarity: 0.95, rms: 0.02, now: 30 * STEP_MS + i * STEP_MS, windowMs: slowWindow }, slow, SIX)
  }
  ok('a never-agreeing run still escapes on the derived timeout',
    st2.smoothed === null || Math.abs(cents(st2.smoothed, was)) > 20,
    `still at ${st2.smoothed === null ? 'null' : st2.smoothed.toFixed(2)} (was ${was.toFixed(2)})`)
}

console.log('\n12-string course pair')
{
  const st = createTrackerState()
  feed(st, { hz: 82.41, count: 15, settings: S, strings: TWELVE })
  const r = feed(st, { hz: 164.81, count: 40, settings: S, strings: TWELVE, t0: 15 * STEP_MS })
  near(r.hz, 164.81, 3, 'E3 of the E course is reported as E3, not folded to E2')
}

console.log('\nDrop C low string')
{
  const st = createTrackerState()
  const r = feed(st, { hz: 65.41, count: 30, settings: S, strings: DROP_C })
  near(r.hz, 65.41, 2, 'C2 is tracked')
}

console.log(`\n${failures === 0 ? '\x1b[32mall ' + checks + ' checks passed\x1b[0m' : '\x1b[31m' + failures + ' of ' + checks + ' checks failed\x1b[0m'}\n`)
process.exit(failures === 0 ? 0 : 1)
