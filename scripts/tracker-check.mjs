// Drives src/utils/pitchTracker.js with synthetic frame sequences.
//
// There is no test runner in this repo and this needs none: `node
// scripts/tracker-check.mjs` exercises the decisions that were previously only
// observable with a guitar in hand. Frames carry detector *candidates* — a list of
// { hz, n, support, fresh } — so the choice among competing periods (the note being
// held, the string just plucked, the subharmonic two strings share) is tested here
// without any audio at all. scripts/pipeline-bench.mjs covers the audio side.

import {
  createTrackerState, trackPitch, resolveOctave, emaAlpha, pickMpm, effectiveGate, cents,
} from '../src/utils/pitchTracker.js'
import { getTunings } from '../src/data/tunings.js'
import { SETTINGS_DEFAULTS } from '../src/data/settings.js'

const SIX = getTunings(440).guitar6.tunings.standard.strings
const TWELVE = getTunings(440).guitar12.tunings.standard.strings
const DROP_C = getTunings(440).guitar6.tunings.dropC.strings

const E2 = 82.41
const A2 = 110.0
const F2 = 87.31
const G3 = 196.0
const B3 = 246.94
const E4 = 329.63
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

// One candidate, the way the detector reports a lone note.
function single(hz, n = 0.95) {
  return [{ hz, n, support: true, fresh: true }]
}

// Feed `count` frames. `hz` may be a function of index; `candidates` overrides it.
function feed(state, { hz, candidates, count, settings, strings, t0 = 0, n = 0.95, rms = 0.02, step = STEP_MS, fresh = false }) {
  const gates = []
  let now = t0
  for (let i = 0; i < count; i++) {
    now = t0 + i * step
    const cands = candidates
      ? (typeof candidates === 'function' ? candidates(i) : candidates)
      : single(typeof hz === 'function' ? hz(i) : hz, n)
    const r = trackPitch(state, { candidates: cands, rms, now, windowMs: WINDOW_MS, fresh }, settings, strings)
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

console.log("\npickMpm — McLeod's rule over a candidate list")
{
  const list = [{ hz: 330, n: 0.75 }, { hz: 165, n: 0.80 }, { hz: 82.4, n: 1.0 }]
  ok('the highest frequency within k of the tallest peak wins', pickMpm(list, 0.9).hz === 82.4, `got ${pickMpm(list, 0.9)?.hz}`)
  ok('a lower k lets the shorter period through', pickMpm(list, 0.7).hz === 330, `got ${pickMpm(list, 0.7)?.hz}`)
  ok('an empty list yields null', pickMpm([], 0.9) === null)
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
  const r = trackPitch(st, { candidates: single(95), rms: 0.02, now: 20 * STEP_MS, windowMs: WINDOW_MS }, S, SIX)
  ok('a lone off reading does not move the note', Math.abs(cents(st.smoothed, before)) < 0.01, `gate ${r.gate}`)
  ok('and is reported as an outlier', r.gate === 'outlier', `gate ${r.gate}`)
}

console.log('\nSTEP CHANGE without a pluck — the dead-zone regression (E2 → F2, exactly 100¢)')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  const r = feed(st, { hz: F2, count: 40, settings: S, strings: SIX, t0: 20 * STEP_MS })
  near(r.hz, F2, 3, 'a sustained semitone step is followed')
  const settle = r.gates.findIndex(g => g === 'ok') * STEP_MS
  ok('and commits within ~1 window + confirmation', settle > 0 && settle <= 300, `settled after ${settle} ms`)
}

console.log('\nSTEP CHANGE at every distance — no unreachable band')
{
  for (const jump of [50, 60, 75, 85, 95, 100, 110, 150, 200, 400, 700]) {
    const st = createTrackerState()
    feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
    const target = E2 * 2 ** (jump / 1200)
    const r = feed(st, { hz: target, count: 40, settings: S, strings: SIX, t0: 20 * STEP_MS })
    near(r.hz, target, 4, `${jump}¢ step is followed`)
  }
}

console.log('\nPLUCK — a fresh reading switches the note on the first frame')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  // The detector saw an onset: A2 grew, E2 (still ringing, so still supported) did not.
  const cands = [{ hz: A2, n: 0.7, support: true, fresh: true }, { hz: E2, n: 0.6, support: true, fresh: false }]
  const r = trackPitch(st, { candidates: cands, rms: 0.05, now: 20 * STEP_MS, windowMs: WINDOW_MS, fresh: true }, S, SIX)
  near(r.hz, A2, 1, 'the new string is on screen immediately')
  ok('and the frame is accepted, not pending', r.gate === 'ok', `gate ${r.gate}`)
}

console.log('\nPLUCK — the subharmonic two strings share is not the note just played')
{
  // B3 and E4 ringing together repeat at E2's period, and a real low E is ringing
  // too, so E2 is both the tallest peak and spectrally supported. Only E4 grew.
  const st = createTrackerState()
  feed(st, { hz: B3, count: 20, settings: S, strings: SIX })
  const cands = [
    { hz: E4, n: 0.75, support: true, fresh: true },
    { hz: B3, n: 0.30, support: true, fresh: false },
    { hz: E2, n: 1.00, support: true, fresh: false },
  ]
  const r = trackPitch(st, { candidates: cands, rms: 0.05, now: 20 * STEP_MS, windowMs: WINDOW_MS, fresh: true }, S, SIX)
  near(r.hz, E4, 1, 'the string that grew wins over the taller subharmonic')
}

console.log('\nno pluck — a supported taller peak still needs confirming')
{
  const st = createTrackerState()
  feed(st, { hz: G3, count: 20, settings: S, strings: SIX })
  const cands = [{ hz: E2, n: 0.9, support: true, fresh: false }, { hz: G3, n: 0.4, support: true, fresh: false }]
  const r = trackPitch(st, { candidates: cands, rms: 0.02, now: 20 * STEP_MS, windowMs: WINDOW_MS }, S, SIX)
  near(r.hz, G3, 1, 'the held note is not abandoned on one reading')
  ok('the far reading goes to pending instead', r.gate === 'outlier', `gate ${r.gate}`)
}

console.log('\ncandidates without spectral support are ignored')
{
  const st = createTrackerState()
  const cands = [{ hz: E2, n: 1.0, support: false, fresh: true }, { hz: A2, n: 0.8, support: true, fresh: true }]
  const r = trackPitch(st, { candidates: cands, rms: 0.02, now: 0, windowMs: WINDOW_MS, fresh: true }, S, SIX)
  near(r.hz, A2, 1, 'a peak with no partials behind it is skipped')
}

console.log('\ncontinuation survives low clarity while a new note needs more')
{
  const st = createTrackerState()
  feed(st, { hz: G3, count: 20, settings: S, strings: SIX })
  const dim = [{ hz: E2, n: 0.9, support: true, fresh: false }, { hz: G3, n: S.clarityTrack + 0.02, support: true, fresh: false }]
  const r1 = trackPitch(st, { candidates: dim, rms: 0.02, now: 20 * STEP_MS, windowMs: WINDOW_MS }, S, SIX)
  ok('the held note keeps updating just above clarityTrack', r1.gate === 'ok' && Math.abs(cents(r1.hz, G3)) < 1, `gate ${r1.gate}`)
  const st2 = createTrackerState()
  const r2 = trackPitch(st2, { candidates: single(G3, S.clarityThreshold - 0.02), rms: 0.02, now: 0, windowMs: WINDOW_MS }, S, SIX)
  ok('but a new note below clarityThreshold is not shown', r2.hz === null && r2.gate === 'clarity', `gate ${r2.gate}`)
}

console.log('\nre-plucking the same string is a continuation, not a change')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  // Hard re-pluck: the attack reads 40¢ sharp for a few frames, flagged fresh.
  const r = feed(st, { hz: i => E2 * 2 ** (Math.max(0, 40 - 12 * i) / 1200), count: 12, settings: S, strings: SIX, t0: 20 * STEP_MS, fresh: true })
  ok('every frame is accepted', r.gates.every(g => g === 'ok'), `gates: ${[...new Set(r.gates)].join(',')}`)
  near(r.hz, E2, 3, 'and the reading settles back on E2')
}

console.log('\nfalse onset — nothing grew, so the held note carries on')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  const cands = [{ hz: E2, n: 0.9, support: true, fresh: false }]
  const r = trackPitch(st, { candidates: cands, rms: 0.05, now: 20 * STEP_MS, windowMs: WINDOW_MS, fresh: true }, S, SIX)
  ok('the frame is accepted as continuation', r.gate === 'ok' && Math.abs(cents(r.hz, E2)) < 1, `gate ${r.gate}`)
}

console.log('\nattack transient at cold start')
{
  const st = createTrackerState()
  // A hard pluck reads sharp for the first few frames; the display must not stay there.
  const r = feed(st, { hz: i => E2 * 2 ** (Math.max(0, 45 - 9 * i) / 1200), count: 40, settings: S, strings: SIX, fresh: true })
  near(r.hz, E2, 2, 'settles on the true pitch, not the sharp attack')
  ok('the first frame is already on screen', r.gates[0] === 'ok', `gate ${r.gates[0]}`)
}

console.log('\nadaptive noise gate')
{
  const st = createTrackerState()
  ok('the gate starts at the absolute floor', Math.abs(effectiveGate(st, S) - S.noiseGate) < 1e-12, `got ${effectiveGate(st, S)}`)
  // Opening the app on a ringing note must not make the note the floor.
  const r0 = trackPitch(st, { candidates: single(E2), rms: 0.05, now: 0, windowMs: WINDOW_MS, fresh: true }, S, SIX)
  ok('a loud first frame is accepted', r0.gate === 'ok', `gate ${r0.gate}`)
  // A steady room at 0.002 RMS: the gate learns it and sits ~4 dB above.
  const st2 = createTrackerState()
  feed(st2, { candidates: [], count: 60, settings: S, strings: SIX, rms: 0.002 })
  const g = effectiveGate(st2, S)
  ok('the gate settles above the learned floor', g > 0.003 && g < 0.0033, `gate ${g.toFixed(4)}`)
  const rQuiet = trackPitch(st2, { candidates: single(E2), rms: 0.0025, now: 60 * STEP_MS, windowMs: WINDOW_MS, fresh: true }, S, SIX)
  ok('a reading barely above the room is gated', rQuiet.gate === 'noise', `gate ${rQuiet.gate}`)
  const rLoud = trackPitch(st2, { candidates: single(E2), rms: 0.005, now: 61 * STEP_MS, windowMs: WINDOW_MS, fresh: true }, S, SIX)
  ok('one clearly above it is not', rLoud.gate === 'ok', `gate ${rLoud.gate}`)
  // A three-second note lifts the floor by well under a factor of two.
  const st3 = createTrackerState()
  feed(st3, { hz: E2, count: 100, settings: S, strings: SIX, rms: 0.05 })
  ok('a sustained note barely moves the floor', effectiveGate(st3, S) < 0.003, `gate ${effectiveGate(st3, S).toFixed(4)}`)
}

console.log('\nscattered pending — must not stay stuck')
{
  const st = createTrackerState()
  feed(st, { hz: E2, count: 20, settings: S, strings: SIX })
  const before = st.smoothed
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
  const r = feed(st, { candidates: [], count: 60, settings: S, strings: SIX, rms: 0, t0: 20 * STEP_MS })
  ok('and cleared once holdMs has passed in silence', r.hz === null, `hz ${r.hz}`)
  ok('the clearing frame reports why', r.gates.includes('hold'), `gates: ${[...new Set(r.gates)].join(',')}`)
}

console.log('\nhold is evaluated even while every frame is being discarded')
{
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
  const slowWindow = (16384 / 48000) * 1000
  const slow = { ...S, confirmFrames: 6, windowSize: 16384 }
  const st = createTrackerState()
  const feedSlow = (state, hz, count, t0) => {
    const gates = []
    for (let i = 0; i < count; i++) {
      const rawHz = typeof hz === 'function' ? hz(i) : hz
      gates.push(trackPitch(state, { candidates: single(rawHz), rms: 0.02, now: t0 + i * STEP_MS, windowMs: slowWindow }, slow, SIX).gate)
    }
    return gates
  }
  feedSlow(st, E2, 30, 0)
  const target = E2 * 2 ** (500 / 1200)
  feedSlow(st, target, 60, 30 * STEP_MS)
  near(st.smoothed, target, 4, 'a 500¢ step is still followed with confirmFrames 6 and a 341 ms window')
  const st2 = createTrackerState()
  feedSlow(st2, E2, 30, 0)
  const was = st2.smoothed
  feedSlow(st2, i => 95 * 2 ** ((i % 3 === 0 ? 70 : i % 3 === 1 ? -70 : 0) / 1200), 120, 30 * STEP_MS)
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
