// Measures the detector on synthetic plucked strings, offline and repeatable.
//
// This exists because the parameters in src/data/settings.js should be chosen from
// numbers rather than taste. It answers why the analysis window is 8192 and not
// 4096 (in a realistically noisy room 8192 roughly halves the jitter), and what the
// spectral refinement buys over the raw NSDF peak (`sd ref` vs `sd nsdf`). Run it
// after changing any signal-chain default; scripts/pipeline-bench.mjs is the one
// that covers whole tuning sessions through the tracker.
//
//   node scripts/detector-bench.mjs
//
// A browser is a poor instrument for this: Chromium's fake capture device is not
// sample-accurate and introduces a systematic offset of its own. Use the real mic
// and the in-app debug overlay for the final word, and this for the comparisons.

import { SETTINGS_DEFAULTS } from '../src/data/settings.js'
import { Detector } from '../src/utils/detector.js'
import { pickMpm } from '../src/utils/pitchTracker.js'
import { SR, cents, biquad, applyBiquad, pluck, decayFor, makeRng } from './lib/synth.mjs'

const hp = biquad('highpass', SETTINGS_DEFAULTS.hpFreq, 0.7, SR)
const lp = biquad('lowpass', SETTINGS_DEFAULTS.lpFreq, 0.7, SR)

function scene(f0, { gain, noise, fundamentalDb = 0 }) {
  const a = pluck(f0, 3.0, { decay: decayFor(f0), fundamentalDb })
  const rng = makeRng(42)
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = gain * a[i] + (rng() * 2 - 1) * noise
  return applyBiquad(applyBiquad(out, hp), lp)
}

function measure(sig, f0, N) {
  const d = new Detector(N)
  const win = new Float32Array(N)
  const rows = []
  for (let start = 0; start + N < sig.length; start += Math.round(SR * 0.03)) {
    win.set(sig.subarray(start, start + N))
    const t = (start + N) / SR
    const { rms, candidates } = d.analyse(win, SR, t * 1000, SETTINGS_DEFAULTS.noiseGate)
    const c = pickMpm(candidates.filter(x => x.support), SETTINGS_DEFAULTS.mpmK)
    rows.push({ t, rms, c })
  }
  const usable = rows.filter(r => r.c && r.c.n >= SETTINGS_DEFAULTS.clarityThreshold)
  // From 0.6 s on: the attack glide has died and the reading is what the tuner shows parked.
  const steady = usable.filter(r => r.t >= 0.6 && r.t <= 2.0)
  const stat = xs => {
    if (!xs.length) return { mean: NaN, sd: NaN }
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length
    return { mean, sd: Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) }
  }
  const ref = stat(steady.map(r => cents(r.c.hz, f0)))
  const nsdf = stat(steady.map(r => cents(r.c.hzNsdf, f0)))
  const octaveErrors = usable.filter(r => Math.abs(cents(r.c.hz, f0)) > 200).length
  return {
    kept: steady.length,
    of: rows.filter(r => r.t >= 0.6 && r.t <= 2.0).length,
    mean: ref.mean, sd: ref.sd, sdNsdf: nsdf.sd, octaveErrors,
    held: usable.length ? Math.max(...usable.map(r => r.t)) : 0,
  }
}

const STRINGS = [['C2 (Drop C)', 65.41], ['E2 (low E)', 82.41], ['D3', 146.83], ['E4 (high e)', 329.63]]
const CONDITIONS = [
  ['close mic, quiet room', { gain: 1.0, noise: 0.002 }],
  ["arm's length, noisy room", { gain: 0.35, noise: 0.008 }],
  ['phone mic, weak fundamental (-12 dB)', { gain: 0.5, noise: 0.004, fundamentalDb: -12 }],
]
const WINDOWS = [4096, 8192, 16384]

const f = (x, w, d = 2) => (isNaN(x) ? 'n/a'.padStart(w) : x.toFixed(d).padStart(w))

console.log(`\nDefaults in play: hp ${SETTINGS_DEFAULTS.hpFreq} Hz, lp ${SETTINGS_DEFAULTS.lpFreq} Hz, ` +
  `gate ${SETTINGS_DEFAULTS.noiseGate}, clarity ${SETTINGS_DEFAULTS.clarityThreshold}, k ${SETTINGS_DEFAULTS.mpmK}, window ${SETTINGS_DEFAULTS.windowSize}`)
console.log('kept = frames passing the gates between 0.6 s and 2.0 s into the note')
console.log('sd ref / sd nsdf = jitter of the refined reading vs the raw NSDF peak; oct = octave errors')
console.log('held = last moment in the decay a frame was still usable\n')

for (const [label, opts] of CONDITIONS) {
  console.log(`──── ${label}`)
  console.log('  string          window   kept      mean   sd ref  sd nsdf  oct   held')
  for (const [name, f0] of STRINGS) {
    const sig = scene(f0, opts)
    for (const N of WINDOWS) {
      const r = measure(sig, f0, N)
      console.log(`  ${name.padEnd(14)} ${String(N).padStart(6)}   ` +
        `${String(r.kept).padStart(3)}/${String(r.of).padEnd(3)} ${f(r.mean, 7)}¢ ${f(r.sd, 6)}¢ ${f(r.sdNsdf, 7)}¢  ${String(r.octaveErrors).padStart(3)}  ${r.held.toFixed(2)}s`)
    }
    console.log()
  }
}
