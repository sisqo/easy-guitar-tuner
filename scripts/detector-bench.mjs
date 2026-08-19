// Measures the detector on synthetic plucked strings, offline and repeatable.
//
// This exists because the parameters in src/data/settings.js should be chosen from
// numbers rather than taste. It answers, in particular, why the analysis window is
// 8192 and not 4096: on a clean signal they are indistinguishable, but in a
// realistically noisy one 8192 roughly halves the jitter. Run it after changing any
// signal-chain default.
//
//   node scripts/detector-bench.mjs
//
// A browser is a poor instrument for this: Chromium's fake capture device is not
// sample-accurate and introduces a systematic offset of its own. Use the real mic
// and the in-app debug overlay for the final word, and this for the comparisons.

import { PitchDetector } from 'pitchy'
import { SETTINGS_DEFAULTS } from '../src/data/settings.js'

const SR = 48000
const cents = (a, b) => 1200 * Math.log2(a / b)

// RBJ cookbook biquad, so the bench sees the same filter chain usePitchDetector wires up.
function biquad(type, f0, Q, sr) {
  const w = (2 * Math.PI * f0) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * Q)
  let b0, b1, b2
  if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2 }
  else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2 }
  const a0 = 1 + al
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cw) / a0, a2: (1 - al) / a0 }
}

function applyBiquad(x, c) {
  const y = new Float32Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v
  }
  return y
}

// A plucked steel string: inharmonic partials from string stiffness, faster decay
// for higher partials, and the sharp attack a hard pluck really has — a pitch that
// starts ~45 cents high and relaxes over about 60 ms.
function pluck(f0, seconds, { attackCents = 45 } = {}) {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const bend = 2 ** ((attackCents * Math.exp(-t / 0.06)) / 1200)
    let v = 0
    for (let k = 1; k <= 14; k++) {
      const fk = k * f0 * Math.sqrt(1 + 1.2e-5 * k * k) * bend
      if (fk > SR / 2) break
      v += (1 / k ** 1.15) * Math.exp(-t / (1.6 / k ** 0.85)) * Math.sin(2 * Math.PI * fk * t)
    }
    out[i] = v * 0.25 * Math.min(1, t / 0.004) * Math.exp(-t / 1.6)
  }
  return out
}

const hp = biquad('highpass', SETTINGS_DEFAULTS.hpFreq, 0.7, SR)
const lp = biquad('lowpass', SETTINGS_DEFAULTS.lpFreq, 0.7, SR)

function scene(f0, { gain, noise }) {
  const a = pluck(f0, 3.0)
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = gain * a[i] + (Math.random() * 2 - 1) * noise
  return applyBiquad(applyBiquad(out, hp), lp)
}

function measure(sig, f0, N, clarityThreshold) {
  const d = PitchDetector.forFloat32Array(N)
  d.clarityThreshold = SETTINGS_DEFAULTS.mpmK
  const win = new Float32Array(N)
  const rows = []
  for (let start = 0; start + N < sig.length; start += Math.round(SR * 0.03)) {
    win.set(sig.subarray(start, start + N))
    let rms = 0
    for (let i = 0; i < N; i++) rms += win[i] * win[i]
    rms = Math.sqrt(rms / N)
    const [hz, cl] = d.findPitch(win, SR)
    rows.push({ t: (start + N / 2) / SR, hz, cl, rms })
  }
  const usable = rows.filter(r =>
    r.rms >= SETTINGS_DEFAULTS.noiseGate && r.cl >= clarityThreshold && r.hz >= 60 && r.hz <= 660)
  const steady = usable.filter(r => r.t >= 0.35 && r.t <= 2.0)
  const err = steady.map(r => cents(r.hz, f0))
  const mean = err.length ? err.reduce((a, b) => a + b, 0) / err.length : NaN
  const sd = err.length ? Math.sqrt(err.reduce((a, b) => a + (b - mean) ** 2, 0) / err.length) : NaN
  return {
    kept: err.length,
    of: rows.filter(r => r.t >= 0.35 && r.t <= 2.0).length,
    mean, sd,
    held: usable.length ? Math.max(...usable.map(r => r.t)) : 0,
  }
}

const STRINGS = [['C2 (Drop C)', 65.41], ['E2 (low E)', 82.41], ['D3', 146.83], ['E4 (high e)', 329.63]]
const CONDITIONS = [
  ['close mic, quiet room', { gain: 1.0, noise: 0.002 }],
  ['arm\'s length, noisy room', { gain: 0.35, noise: 0.008 }],
]
const WINDOWS = [4096, 8192, 16384]

const f = (x, w, d = 2) => (isNaN(x) ? 'n/a'.padStart(w) : x.toFixed(d).padStart(w))

console.log(`\nDefaults in play: hp ${SETTINGS_DEFAULTS.hpFreq} Hz, lp ${SETTINGS_DEFAULTS.lpFreq} Hz, ` +
  `gate ${SETTINGS_DEFAULTS.noiseGate}, k ${SETTINGS_DEFAULTS.mpmK}, window ${SETTINGS_DEFAULTS.windowSize}`)
console.log('kept = frames surviving every gate between 0.35 s and 2.0 s into the note')
console.log('held = last moment in the decay a frame was still usable\n')

for (const [label, opts] of CONDITIONS) {
  console.log(`──── ${label}`)
  console.log('  string          window  clarity   kept      mean       sd     held')
  for (const [name, f0] of STRINGS) {
    const sig = scene(f0, opts)
    for (const N of WINDOWS) {
      for (const ct of [0.82, 0.90]) {
        const r = measure(sig, f0, N, ct)
        console.log(`  ${name.padEnd(14)} ${String(N).padStart(6)}    ${ct.toFixed(2)}   ` +
          `${String(r.kept).padStart(3)}/${String(r.of).padEnd(3)} ${f(r.mean, 7)}¢ ${f(r.sd, 6)}¢  ${r.held.toFixed(2)}s`)
      }
    }
    console.log()
  }
}
