// Pitch detector: McLeod's NSDF for the period decision, a Hann power spectrum for
// everything the NSDF cannot tell on its own. Plain JS, no React, no Web Audio, so
// scripts/ can drive it with synthetic signals.
//
// Why not pitchy's PitchDetector any more: it returns one pitch — the first NSDF
// peak above k times the highest — and that rule breaks down the moment the string
// you plucked before is still ringing. Two strings together are periodic at their
// common subharmonic (E2 + A2 repeat every 36 ms), so the highest peak sits there
// and the new string's own peak, at maybe 80% of it, is skipped. Measured on a
// simulated tuning session, plucking the six strings 0.7 s apart without muting
// showed *nothing* for five of the six: every frame was thrown out as out of range.
//
// So this detector returns every plausible period as a candidate and leaves the
// choice to pitchTracker, which knows what note it is holding and whether a pluck
// just happened. Per candidate it adds two facts from the spectrum:
//
//  - support: the candidate's fundamental or 2nd harmonic really carries energy.
//    A subharmonic that only "explains" other strings' partials has none.
//  - fresh: right after a pluck, the fundamental's power *grew* compared with the
//    spectrum from before the pluck. What grew is the note the user just played;
//    what did not is the string still ringing from before.
//
// The spectrum also refines the frequency. The NSDF peak of the note you are
// tuning is pulled by whatever else is ringing — a D3 left sounding under a G3
// biased the G3 reading by -4 cents, more than the whole in-tune zone — whereas
// the note's own partials sit at their own frequencies regardless. Each candidate's
// frequency is re-estimated from its first partials with Grandke's interpolator
// (exact for a Hann window), and only falls back to the NSDF value when no partial
// peak is found.

import FFT from 'fft.js'

// 60 clears Drop C's low C2 (65.41 Hz at A440, 64.2 at A432) with headroom for a
// slack string being brought up, and rejects 50 Hz mains hum by construction.
export const MIN_FREQ = 60
export const MAX_FREQ = 660

// A candidate whose fundamental *and* 2nd harmonic both sit this far below the
// strongest partial has no note behind it.
const SUPPORT_DB = 30

// A partial this far below the strongest one is noise, not evidence, for the
// freshness test and for frequency refinement.
const NOISE_DB = 40

// Fraction of a fundamental's power that must be new (vs. the pre-pluck spectrum)
// for its candidate to count as the note just played.
const FRESH_GROWTH = 0.5

// RMS growth against one window ago that counts as a pluck (+2.6 dB). A note only
// ever decays, so any real rise is an attack; a pluck that lifts the total by less
// than this holds under half the energy and could not pass the clarity gate anyway.
// A false alarm is free: nothing has grown, so the fresh pool is empty and the
// tracker falls back to following the note it holds.
const ONSET_RATIO = 1.35

// How long after a pluck the pre-pluck spectrum stays the reference, in windows.
const FRESH_WINDOWS = 1.5

// Search half-width around k·f for the k-th partial, as a fraction of frequency.
// Wide enough for a string 25 cents off plus stiffness, tight enough to keep a
// neighbouring string's partial out.
const PARTIAL_TOL = 0.015

// Key maxima below this can never be chosen (the tracker needs at least 0.45
// clarity) and are dropped to keep the candidate list short.
const MIN_PEAK = 0.3

// How much each of partials 1..4 may count when combining their frequency
// estimates, on top of the statistical weight (magnitude × k)² — the k-th partial's
// frequency error divides by k, so higher partials measure the fundamental more
// precisely. They also read sharp from string stiffness (h3 by about a cent on a
// plain G string, h4 by two), so beyond h2 they only fill in when the lower
// partials are weak, as on a phone microphone's rolled-off low E.
const PARTIAL_WEIGHTS = [1, 1, 0.35, 0.15]

export function cents(a, b) {
  return 1200 * Math.log2(a / b)
}

function parabolicPeak(i, data) {
  const y0 = data[i - 1], y1 = data[i], y2 = data[i + 1]
  const a = y0 / 2 - y1 + y2 / 2
  if (a >= 0) return [i, y1]
  const b = (y2 - y0) / 2
  const dx = -b / (2 * a)
  return [i + dx, y1 - (b * b) / (4 * a)]
}

export class Detector {
  constructor(size) {
    this.size = size
    this.fftAcf = new FFT(2 * size)
    this.fftSpec = new FFT(size)
    this.padded = new Float64Array(2 * size)
    this.acfSpec = new Float64Array(4 * size)
    this.acf = new Float64Array(4 * size)
    this.nsdf = new Float64Array(size)
    this.windowed = new Float64Array(size)
    this.specC = new Float64Array(2 * size)
    this.bins = size / 2 + 1
    this.power = new Float64Array(this.bins)
    this.hann = new Float64Array(size)
    for (let i = 0; i < size; i++) this.hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size))
    // Recent frames: { at, rms, power | null }. The onset test compares against the
    // frame one window back; the pre-pluck spectrum is taken from the same place.
    this.history = []
    this.refPower = null
    this.onsetAt = -Infinity
  }

  /**
   * Analyse one window of samples.
   *
   * gateLevel: RMS below which the period search is skipped (the frame is still
   *   recorded, so onsets are detected across silence).
   * Returns { rms, fresh, candidates } where candidates are sorted by descending
   * frequency, each { hz, n, support, fresh, hzNsdf }.
   */
  analyse(input, sampleRate, now, gateLevel, { minHz = MIN_FREQ, maxHz = MAX_FREQ } = {}) {
    const N = this.size
    const windowMs = (N / sampleRate) * 1000

    let sum = 0
    for (let i = 0; i < N; i++) sum += input[i] * input[i]
    const rms = Math.sqrt(sum / N)

    // One window back: the most recent frame that does not overlap this one.
    let back = null
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].at <= now - windowMs) { back = this.history[i]; break }
    }
    if (back && rms >= ONSET_RATIO * back.rms && rms >= gateLevel) {
      // A second pluck inside the fresh period keeps the older reference: it is
      // from before both of them.
      if (now - this.onsetAt > FRESH_WINDOWS * windowMs) this.refPower = back.power
      this.onsetAt = now
    }
    const fresh = now - this.onsetAt <= FRESH_WINDOWS * windowMs

    if (rms < gateLevel) {
      this.remember(now, rms, null, windowMs)
      return { rms, fresh, candidates: [] }
    }

    this.spectrum(input)
    this.remember(now, rms, this.power.slice(), windowMs)

    const candidates = this.periods(input, sampleRate, minHz, maxHz)
    const pMax = this.strongestPartial(minHz, sampleRate)
    for (const c of candidates) {
      c.support = this.supported(c.hzNsdf, sampleRate, pMax)
      c.fresh = fresh ? this.grew(c.hzNsdf, sampleRate, pMax) : c.support
      c.hz = c.support ? this.refine(c.hzNsdf, sampleRate, pMax) : c.hzNsdf
    }
    return { rms, fresh, candidates }
  }

  remember(now, rms, power, windowMs) {
    this.history.push({ at: now, rms, power })
    const keepFrom = now - 2.5 * windowMs
    while (this.history.length && this.history[0].at < keepFrom) this.history.shift()
  }

  // Hann-windowed power spectrum of the frame into this.power.
  spectrum(input) {
    const N = this.size
    for (let i = 0; i < N; i++) this.windowed[i] = input[i] * this.hann[i]
    this.fftSpec.realTransform(this.specC, this.windowed)
    for (let b = 0; b < this.bins; b++) {
      const re = this.specC[2 * b], im = this.specC[2 * b + 1]
      this.power[b] = re * re + im * im
    }
  }

  // NSDF via zero-padded autocorrelation, then every key maximum in range.
  periods(input, sampleRate, minHz, maxHz) {
    const N = this.size
    this.padded.set(input)
    this.padded.fill(0, N)
    this.fftAcf.realTransform(this.acfSpec, this.padded)
    this.fftAcf.completeSpectrum(this.acfSpec)
    const s = this.acfSpec
    for (let i = 0; i < s.length; i += 2) {
      s[i] = s[i] * s[i] + s[i + 1] * s[i + 1]
      s[i + 1] = 0
    }
    this.fftAcf.inverseTransform(this.acf, this.acfSpec)

    const nsdf = this.nsdf
    let m = 2 * this.acf[0]
    let i
    for (i = 0; i < N && m > 0; i++) {
      nsdf[i] = (2 * this.acf[2 * i]) / m
      m -= input[i] * input[i] + input[N - 1 - i] * input[N - 1 - i]
    }
    for (; i < N; i++) nsdf[i] = 0

    const tauMin = sampleRate / maxHz
    const tauMax = sampleRate / minHz
    const scanTo = Math.min(N - 1, Math.ceil(tauMax * 1.25))
    const out = []
    let looking = false, max = -Infinity, maxIdx = -1
    const flush = () => {
      if (maxIdx > 0 && max >= MIN_PEAK) {
        const [tau, n] = parabolicPeak(maxIdx, nsdf)
        if (tau >= tauMin && tau <= tauMax) {
          const hz = sampleRate / tau
          out.push({ hz, hzNsdf: hz, n: Math.min(n, 1), support: false, fresh: false })
        }
      }
      maxIdx = -1
    }
    for (let t = 1; t < scanTo; t++) {
      if (nsdf[t - 1] <= 0 && nsdf[t] > 0) {
        looking = true; maxIdx = t; max = nsdf[t]
      } else if (nsdf[t - 1] > 0 && nsdf[t] <= 0) {
        looking = false; flush()
      } else if (looking && nsdf[t] > max) {
        max = nsdf[t]; maxIdx = t
      }
    }
    if (looking) flush()
    return out
  }

  // Strongest bin from minHz up — hum below the range must not set the reference.
  strongestPartial(minHz, sampleRate) {
    const from = Math.max(1, Math.floor((minHz * this.size) / sampleRate))
    let pMax = 0
    for (let b = from; b < this.bins; b++) if (this.power[b] > pMax) pMax = this.power[b]
    return pMax
  }

  // Highest bin within PARTIAL_TOL of f (at least ±1 bin) that is a local maximum —
  // the skirt of a neighbouring partial's lobe is not a partial. Returns
  // [bin, power], or [-1, 0] when there is no peak.
  peakNear(f, sampleRate, power = this.power) {
    const c = (f * this.size) / sampleRate
    const w = Math.max(1, c * PARTIAL_TOL)
    const lo = Math.max(1, Math.floor(c - w)), hi = Math.min(this.bins - 2, Math.ceil(c + w))
    let best = -1, bestP = 0
    for (let b = lo; b <= hi; b++) {
      if (power[b] > bestP && power[b] >= power[b - 1] && power[b] >= power[b + 1]) { bestP = power[b]; best = b }
    }
    return [best, bestP]
  }

  supported(hz, sampleRate, pMax) {
    const floor = pMax * 10 ** (-SUPPORT_DB / 10)
    return this.peakNear(hz, sampleRate)[1] >= floor || this.peakNear(2 * hz, sampleRate)[1] >= floor
  }

  // Did this candidate's fundamental gain power since before the pluck? With no
  // pre-pluck spectrum (cold start from silence) everything present is new.
  grew(hz, sampleRate, pMax) {
    const [b, pNow] = this.peakNear(hz, sampleRate)
    if (b < 0 || pNow < pMax * 10 ** (-NOISE_DB / 10)) return false
    if (!this.refPower) return true
    const pBefore = this.peakNear(hz, sampleRate, this.refPower)[1]
    return (pNow - pBefore) / pNow >= FRESH_GROWTH
  }

  // Re-estimate hz from its own partial peaks. Grandke's interpolator on the two
  // largest adjacent Hann bins is exact for a stationary tone.
  refine(hz, sampleRate, pMax) {
    const noise = pMax * 10 ** (-NOISE_DB / 10)
    const binHz = sampleRate / this.size
    let num = 0, den = 0
    for (let k = 1; k <= PARTIAL_WEIGHTS.length; k++) {
      const [b, p] = this.peakNear(k * hz, sampleRate)
      if (b < 1 || p < noise) continue
      const pw = this.power
      const m0 = Math.sqrt(pw[b]), mL = Math.sqrt(pw[b - 1]), mR = Math.sqrt(pw[b + 1])
      let delta
      if (mR >= mL) { const a = mR / m0; delta = (2 * a - 1) / (a + 1) }
      else { const a = mL / m0; delta = -(2 * a - 1) / (a + 1) }
      const est = ((b + delta) * binHz) / k
      if (Math.abs(cents(est, hz)) > 60) continue
      const w = (m0 * k) ** 2 * PARTIAL_WEIGHTS[k - 1]
      num += w * est
      den += w
    }
    return den > 0 ? num / den : hz
  }
}
