// Runs the *whole* pipeline — filters, windowed MPM, pitchTracker — on realistic
// tuning sessions, offline and repeatable. detector-bench.mjs measures the
// detector on a single clean note; this one measures what the user actually sees:
// how long after a pluck the display moves, whether it follows a string change
// while the previous string is still ringing, how far into the decay a quiet
// pluck stays tracked, and whether noise or hum ever shows a note.
//
//   node scripts/pipeline-bench.mjs
//   PRESET=steady node scripts/pipeline-bench.mjs                         # a built-in preset
//   SETTINGS='{"clarityThreshold":0.7}' node scripts/pipeline-bench.mjs   # try overrides
//
// Columns: first = ms from the pluck until the display is within 15¢ of the note,
// settle = ms until within 3¢, correct = share of frames between 0.6 s and 1.8 s
// into the note that read within 5¢ (the attack glide has died by then), wrong = frames that displayed a different
// note (> 30¢ off), until = last moment in the decay the reading was still right,
// sd = jitter of the displayed cents while parked.

import { Detector } from '../src/utils/detector.js'
import { createTrackerState, trackPitch, effectiveGate } from '../src/utils/pitchTracker.js'
import { getTunings } from '../src/data/tunings.js'
import { SR, cents, biquad, applyBiquad, pluck, decayFor, makeRng, hum } from './lib/synth.mjs'
import { resolveBenchSettings, benchSettingsLabel } from './lib/bench-settings.mjs'

const STEP_S = 0.03 // ANALYSIS_INTERVAL_MS
const S = resolveBenchSettings()
const SIX = getTunings(440).guitar6.tunings.standard.strings
const F = Object.fromEntries(SIX.map(s => [s.label, s.freq]))

function scene({ seconds, events, noise = 0.003, humAmp = 0, micHp = 0, seed = 1 }) {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  for (const ev of events) {
    const p = pluck(ev.f0, seconds - ev.t, { decay: decayFor(ev.f0), ...ev.opts })
    const at = Math.floor(ev.t * SR)
    for (let i = 0; i < p.length && at + i < n; i++) out[at + i] += ev.gain * p[i]
  }
  const rng = makeRng(seed)
  for (let i = 0; i < n; i++) out[i] += (rng() * 2 - 1) * noise
  if (humAmp) { const h = hum(seconds, humAmp); for (let i = 0; i < n; i++) out[i] += h[i] }
  let sig = out
  if (micHp) sig = applyBiquad(sig, biquad('highpass', micHp, 0.7))
  sig = applyBiquad(sig, biquad('highpass', S.hpFreq, 0.7))
  return applyBiquad(sig, biquad('lowpass', S.lpFreq, 0.7))
}

function run(sig, strings = SIX) {
  const N = S.windowSize
  const d = new Detector(N)
  const state = createTrackerState()
  const win = new Float32Array(N)
  const step = Math.round(SR * STEP_S)
  const frames = []
  for (let end = N; end <= sig.length; end += step) {
    win.set(sig.subarray(end - N, end))
    const now = (end / SR) * 1000
    const { rms, fresh, candidates } = d.analyse(win, SR, now, effectiveGate(state, S))
    const { hz, gate, pick } = trackPitch(state, { candidates, rms, fresh, now, windowMs: (N / SR) * 1000 }, S, strings)
    frames.push({ t: end / SR, hz, gate, rms, pick, fresh, candidates })
  }
  return frames
}

function noteMetrics(frames, ev, tEnd) {
  const inNote = frames.filter(f => f.t >= ev.t && f.t < tEnd)
  const err = f => (f.hz === null ? Infinity : Math.abs(cents(f.hz, ev.f0)))
  const first = inNote.find(f => err(f) <= 15)
  const settle = inNote.find(f => err(f) <= 3)
  const steady = inNote.filter(f => f.t >= ev.t + 0.6 && f.t <= Math.min(tEnd, ev.t + 1.8))
  const correct = steady.length ? steady.filter(f => err(f) <= 5).length / steady.length : NaN
  const wrong = inNote.filter(f => f.hz !== null && err(f) > 30).length
  const good = inNote.filter(f => err(f) <= 5)
  const until = good.length ? good[good.length - 1].t - ev.t : 0
  const parked = steady.filter(f => f.hz !== null).map(f => cents(f.hz, ev.f0))
  const mean = parked.length ? parked.reduce((a, b) => a + b, 0) / parked.length : NaN
  const sd = parked.length ? Math.sqrt(parked.reduce((a, b) => a + (b - mean) ** 2, 0) / parked.length) : NaN
  const gates = {}
  for (const f of inNote) gates[f.gate] = (gates[f.gate] ?? 0) + 1
  return {
    first: first ? Math.round((first.t - ev.t) * 1000) : null,
    settle: settle ? Math.round((settle.t - ev.t) * 1000) : null,
    correct, wrong, until, sd, gates,
  }
}

const ms = v => (v === null ? '   —  ' : `${String(v).padStart(4)}ms`)
const pct = v => (isNaN(v) ? ' n/a' : `${Math.round(v * 100).toString().padStart(3)}%`)
const gateStr = g => Object.entries(g).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ')

function report(title, frames, events, seconds) {
  console.log(`──── ${title}`)
  console.log('  note        first   settle  correct  wrong  until    sd    gates')
  const rows = []
  events.forEach((ev, i) => {
    const tEnd = i + 1 < events.length ? events[i + 1].t : seconds
    const m = noteMetrics(frames, ev, tEnd)
    rows.push(m)
    console.log(`  ${ev.label.padEnd(10)} ${ms(m.first)}  ${ms(m.settle)}   ${pct(m.correct)}   ${String(m.wrong).padStart(4)}  ${m.until.toFixed(2)}s  ${isNaN(m.sd) ? ' n/a' : m.sd.toFixed(2).padStart(4)}¢  ${gateStr(m.gates)}`)
  })
  console.log()
  return rows
}

console.log(`\nRunning: ${benchSettingsLabel()}`)
console.log(`Settings in play: window ${S.windowSize}, gate ${S.noiseGate}, clarity ${S.clarityThreshold}` +
  (S.clarityTrack !== undefined ? `/${S.clarityTrack}` : '') + `, k ${S.mpmK}, confirm ${S.confirmFrames}, hold ${S.holdMs}\n`)

const summary = {}
function keep(name, rows) { summary[name] = rows }

// 1. One pluck at decreasing strength. The "I have to play loud" complaint lives here:
//    a quiet pluck must still show up, and the display must follow the decay.
{
  const events = []
  const gains = [1.0, 0.3, 0.1, 0.05, 0.025]
  gains.forEach((g, i) => events.push({ t: 0.4 + i * 3.0, f0: F.E2, gain: g, label: `E2 ×${g}` }))
  const seconds = 0.4 + gains.length * 3.0
  const frames = run(scene({ seconds, events, noise: 0.003 }))
  keep('quiet', report('low E, one pluck at decreasing strength (noise 0.003)', frames, events, seconds))
}

// 2. Same for the high e, whose decay is shorter.
{
  const events = []
  const gains = [1.0, 0.3, 0.1, 0.05]
  gains.forEach((g, i) => events.push({ t: 0.4 + i * 2.5, f0: F.E4, gain: g, label: `E4 ×${g}` }))
  const seconds = 0.4 + gains.length * 2.5
  const frames = run(scene({ seconds, events, noise: 0.003 }))
  keep('quietHigh', report('high e, one pluck at decreasing strength (noise 0.003)', frames, events, seconds))
}

// 3. A tuning session: the six strings in order, 1.3 s apart, each one left ringing
//    under the next. This is what "I have to pluck several times" is about.
{
  const rng = makeRng(7)
  const events = SIX.map((s, i) => ({ t: 0.4 + i * 1.3, f0: s.freq, gain: 0.7 + rng() * 0.3, label: s.label }))
  const seconds = 0.4 + SIX.length * 1.3 + 1
  const frames = run(scene({ seconds, events, noise: 0.003 }))
  keep('walk', report('six strings 1.3 s apart, previous strings left ringing', frames, events, seconds))
}

// 4. The hard case: the next string plucked only 0.7 s after the previous one.
{
  const events = SIX.map((s, i) => ({ t: 0.4 + i * 0.7, f0: s.freq, gain: 0.9, label: s.label }))
  const seconds = 0.4 + SIX.length * 0.7 + 1
  const frames = run(scene({ seconds, events, noise: 0.003 }))
  keep('fast', report('six strings 0.7 s apart, previous strings left ringing', frames, events, seconds))
}

// 5. Phone in hand: the mic rolls off below 150 Hz and the low E's fundamental is
//    already 12 dB under its 2nd harmonic. Octave errors show up as "wrong".
{
  const events = [
    { t: 0.4, f0: F.E2, gain: 0.8, label: 'E2', opts: { fundamentalDb: -12 } },
    { t: 3.0, f0: F.A2, gain: 0.8, label: 'A2', opts: { fundamentalDb: -8 } },
    { t: 5.6, f0: F.D3, gain: 0.8, label: 'D3', opts: { fundamentalDb: -4 } },
  ]
  const seconds = 8.5
  const frames = run(scene({ seconds, events, noise: 0.004, micHp: 150 }))
  keep('phone', report('phone mic: 150 Hz rolloff, weak fundamentals', frames, events, seconds))
}

// 6. Noisy room, arm's length — the detector-bench condition, through the tracker.
{
  const events = [
    { t: 0.4, f0: F.E2, gain: 0.35, label: 'E2' },
    { t: 3.4, f0: F.D3, gain: 0.35, label: 'D3' },
    { t: 6.4, f0: F.E4, gain: 0.35, label: 'E4' },
  ]
  const seconds = 9.4
  const frames = run(scene({ seconds, events, noise: 0.008 }))
  keep('noisy', report("arm's length, noisy room (gain 0.35, noise 0.008)", frames, events, seconds))
}

// 7. Nothing played: room noise plus mains hum. Any displayed note is a false positive.
{
  const seconds = 4
  for (const [label, opts] of [['noise 0.004', { noise: 0.004 }], ['noise 0.004 + hum 0.01', { noise: 0.004, humAmp: 0.01 }], ['hum 0.03', { noise: 0.002, humAmp: 0.03 }]]) {
    const frames = run(scene({ seconds, events: [], ...opts }))
    const shown = frames.filter(f => f.hz !== null).length
    const gates = {}
    for (const f of frames) gates[f.gate] = (gates[f.gate] ?? 0) + 1
    console.log(`──── silence: ${label}`)
    console.log(`  frames showing a note: ${shown}/${frames.length}   gates: ${gateStr(gates)}\n`)
    summary[`silence:${label}`] = shown
  }
}

// 8. Quiet pluck on top of hum — the gate must let the note through but not the hum.
{
  const events = [{ t: 0.4, f0: F.A2, gain: 0.1, label: 'A2 ×0.1' }, { t: 3.4, f0: F.G3, gain: 0.1, label: 'G3 ×0.1' }]
  const seconds = 6.4
  const frames = run(scene({ seconds, events, noise: 0.003, humAmp: 0.01 }))
  keep('hum', report('quiet plucks over mains hum 0.01', frames, events, seconds))
}

// One-line digest for comparing runs.
const w = summary.walk, fast = summary.fast
const avg = (rows, k) => { const v = rows.map(r => r[k]).filter(x => x !== null && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN }
console.log('digest')
console.log(`  switch latency, 1.3 s apart: first ${Math.round(avg(w, 'first'))} ms, settle ${Math.round(avg(w, 'settle'))} ms, correct ${pct(avg(w, 'correct'))}, wrong ${w.reduce((a, r) => a + r.wrong, 0)}`)
console.log(`  switch latency, 0.7 s apart: first ${Math.round(avg(fast, 'first'))} ms, settle ${Math.round(avg(fast, 'settle'))} ms, correct ${pct(avg(fast, 'correct'))}, wrong ${fast.reduce((a, r) => a + r.wrong, 0)}`)
console.log(`  quiet low E tracked for: ${summary.quiet.map(r => r.until.toFixed(2) + 's').join(' / ')}`)
console.log(`  quiet high e tracked for: ${summary.quietHigh.map(r => r.until.toFixed(2) + 's').join(' / ')}`)
console.log(`  phone-mic wrong-note frames: ${summary.phone.reduce((a, r) => a + r.wrong, 0)}   noisy-room sd: ${summary.noisy.map(r => r.sd.toFixed(2) + '¢').join(' / ')}`)
console.log()
