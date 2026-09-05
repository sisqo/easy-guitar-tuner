// Shared signal synthesis for the offline benches: a plucked steel string, the RBJ
// biquads that mirror the filter chain usePitchDetector wires up, and a few
// microphone/room imperfections. No React, no Web Audio.

export const SR = 48000

export const cents = (a, b) => 1200 * Math.log2(a / b)

// RBJ cookbook biquad, so the benches see the same filters the app applies.
export function biquad(type, f0, Q, sr = SR) {
  const w = (2 * Math.PI * f0) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * Q)
  let b0, b1, b2
  if (type === 'lowpass') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2 }
  else { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2 }
  const a0 = 1 + al
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cw) / a0, a2: (1 - al) / a0 }
}

export function applyBiquad(x, c) {
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
//
// `fundamentalDb` attenuates partial 1 on its own. A guitar's low E genuinely has a
// 2nd harmonic louder than its fundamental, and a phone microphone rolls off below
// ~150 Hz on top of that — this is what tempts the detector into the octave above.
export function pluck(f0, seconds, { attackCents = 45, fundamentalDb = 0, decay = 1.6 } = {}) {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  const fundGain = 10 ** (fundamentalDb / 20)
  const K = 14
  // Phase is accumulated per sample: sin(2π·f(t)·t) with a time-varying f is not a
  // chirp at f(t) — its instantaneous frequency carries a t·f'(t) term that read
  // several cents flat for a few hundred ms and was mistaken for detector bias.
  const phase = new Float64Array(K + 1)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const bend = 2 ** ((attackCents * Math.exp(-t / 0.06)) / 1200)
    let v = 0
    for (let k = 1; k <= K; k++) {
      const fk = k * f0 * Math.sqrt(1 + 1.2e-5 * k * k) * bend
      if (fk > SR / 2) break
      phase[k] += (2 * Math.PI * fk) / SR
      const g = k === 1 ? fundGain : 1
      v += (g / k ** 1.15) * Math.exp(-t / (decay / k ** 0.85)) * Math.sin(phase[k])
    }
    out[i] = v * 0.25 * Math.min(1, t / 0.004) * Math.exp(-t / decay)
  }
  return out
}

// Amplitude decay time of a plucked string by pitch: a wound low E rings for
// seconds, a plain high e is gone in about one and a half.
export function decayFor(f0) {
  return 2.6 * (82.41 / f0) ** 0.4
}

// Deterministic noise so two runs of a bench are comparable to the sample.
export function makeRng(seed = 12345) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 50 Hz mains hum with the odd harmonics a cheap supply really leaks.
export function hum(seconds, amplitude, f = 50) {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    out[i] = amplitude * (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * 3 * f * t) + 0.2 * Math.sin(2 * Math.PI * 5 * f * t))
  }
  return out
}
