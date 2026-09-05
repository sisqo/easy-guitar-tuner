// Pure pitch-tracking state machine: no React, no Web Audio, no timers of its own.
// Every decision the tuner makes about a frame happens here, so it can be driven
// from scripts/tracker-check.mjs with synthetic frame sequences instead of only
// being observable with a microphone in hand.
//
// A frame carries the detector's *candidates* — every plausible period in range,
// each with its NSDF height `n`, whether the spectrum supports it as a real note,
// and (after a pluck) whether its fundamental is new. Choosing among them is a
// tracking decision, not a signal-processing one, because it depends on what note
// we are holding and whether the player just plucked: so it lives here.

import { MIN_FREQ, MAX_FREQ, cents } from './detector.js'

export { MIN_FREQ, MAX_FREQ, cents }

// Raw readings the median is taken over on the accept path. 5 kills single-frame
// jitter at negligible cost in lag, because a genuine note change never comes
// through this path — it goes through the confirmation machine below.
const MEDIAN_WINDOW = 5

// How tightly pending readings must agree with each other before we believe them
// enough to abandon the note we are holding.
const CONFIRM_SPREAD_CENTS = 35

// Backstop: a pending run this old snaps regardless of spread. Without it a noisy
// signal that never settles within CONFIRM_SPREAD_CENTS could pin the tracker to a
// stale note — the exact failure mode this machine exists to make unreachable.
const PENDING_TIMEOUT_MS = 500

// A pending run older than this is a stale stray, not evidence of a new note.
const PENDING_IDLE_MS = 250

const PENDING_MAX = 16

// How close to a real string a frequency has to sit before we treat it as a
// plausible reading of that string rather than an octave error.
const OCTAVE_PLAUSIBLE_CENTS = 35

// Noise floor: the gate sits this factor above the quietest recent level (~+4 dB).
// The floor drops to any quieter frame at once and climbs only on frames that did
// not yield a note, by at most this fraction per second — so the room is learned
// within a couple of seconds of the mic opening, a ringing note never becomes the
// floor however long it lasts, and the odd loud frame that fails clarity moves it
// by a rounding error. It starts at the absolute gate rather than at the first
// frame's level: opening the app mid-note must not teach it that the note is the
// room.
const FLOOR_RATIO = 1.6
const FLOOR_RISE_PER_S = 0.5

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function spreadCents(values) {
  let lo = Infinity
  let hi = -Infinity
  for (const v of values) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return lo > 0 ? Math.abs(cents(hi, lo)) : Infinity
}

function distToNearestString(hz, strings) {
  let min = Infinity
  for (const s of strings) {
    const d = Math.abs(cents(hz, s.freq))
    if (d < min) min = d
  }
  return min
}

/**
 * Decide which octave a raw reading really belongs to.
 *
 * The detected value is trusted first: if it already sits on a string it is
 * returned untouched, which is what keeps a 12-string's E3 from collapsing onto
 * the ÷2 = E2 of its own course pair. Only when the reading matches no string do
 * we consider ÷2 / ×2, and then only alternatives that land on a string — so a
 * genuinely slack string (a low E sitting 160 cents flat) stays where it is
 * instead of being doubled onto the next string up.
 *
 * With a reference in hand the nearest alternative to it wins, which is what
 * corrects a mid-note jump to the 2nd harmonic. With no reference we keep the raw
 * value: at cold start a slack string and an in-tune string an octave above are
 * genuinely indistinguishable from one frequency, and reporting what was measured
 * is the more truthful of the two guesses.
 */
export function resolveOctave(rawHz, smoothed, strings) {
  if (!strings || !strings.length) return rawHz
  if (distToNearestString(rawHz, strings) <= OCTAVE_PLAUSIBLE_CENTS) return rawHz

  const alternatives = [rawHz / 2, rawHz * 2].filter(
    p => p >= MIN_FREQ && p <= MAX_FREQ && distToNearestString(p, strings) <= OCTAVE_PLAUSIBLE_CENTS
  )
  if (!alternatives.length || smoothed === null) return rawHz

  let best = rawHz
  let minDist = Math.abs(cents(rawHz, smoothed))
  for (const alt of alternatives) {
    const d = Math.abs(cents(alt, smoothed))
    if (d < minDist) {
      minDist = d
      best = alt
    }
  }
  return best
}

// `smoothFactor` is an alpha defined at 60 fps. Rescaling it by the real frame
// interval is what stops the time constant from silently doubling on a 30 fps
// phone, or halving on a 120 Hz display.
export function emaAlpha(base, dtMs) {
  if (!(dtMs > 0)) return base
  const alpha = 1 - Math.pow(1 - base, (dtMs * 60) / 1000)
  return Math.min(1, Math.max(0, alpha))
}

/**
 * McLeod's own choice among the key maxima: the first (shortest period, so highest
 * frequency) whose height reaches k times the tallest. Candidates must be sorted
 * by descending frequency, as the detector returns them.
 */
export function pickMpm(candidates, k) {
  let nMax = -Infinity
  for (const c of candidates) if (c.n > nMax) nMax = c.n
  if (!(nMax > 0)) return null
  return candidates.find(c => c.n >= k * nMax) ?? null
}

export function createTrackerState() {
  return {
    smoothed: null,
    raw: [],
    pending: [],
    pendingSince: null,
    lastAcceptedAt: null,
    lastFrameAt: null,
    floor: null,
  }
}

function clearNote(state) {
  state.smoothed = null
  state.raw = []
  state.pending = []
  state.pendingSince = null
  state.lastAcceptedAt = null
}

function commit(state, hz, seed, now) {
  state.smoothed = hz
  state.raw = seed.slice(-MEDIAN_WINDOW)
  state.pending = []
  state.pendingSince = null
  state.lastAcceptedAt = now
}

function updateFloor(state, rms, dtMs, settings, notePresent) {
  if (state.floor === null) state.floor = settings.noiseGate
  if (rms < state.floor) state.floor = rms
  else if (!notePresent) state.floor = Math.min(rms, state.floor * (1 + (FLOOR_RISE_PER_S * dtMs) / 1000))
}

/** RMS a frame must reach to count as signal: the absolute gate or the adaptive one. */
export function effectiveGate(state, settings) {
  return Math.max(settings.noiseGate, (state.floor ?? 0) * FLOOR_RATIO)
}

/**
 * Choose this frame's reading among the detector's candidates.
 *
 * Three regimes, tried in order:
 *  1. Fresh pluck: only candidates whose fundamental grew since before the pluck
 *     are eligible — the string still ringing from before is not what the user
 *     just played — and McLeod's rule picks among them. Needs `clarityThreshold`.
 *  2. Continuation: the best candidate within `rejectThreshold` of the held note,
 *     accepted down to `clarityTrack`. A decaying string loses clarity long
 *     before it stops being the same note, and a previous string ringing under it
 *     lowers its NSDF share without moving its partials.
 *  3. Cold start / no match: McLeod's rule over every supported candidate, at
 *     `clarityThreshold`.
 */
function choose(candidates, state, settings, fresh) {
  const usable = candidates.filter(c => c.support && c.hz >= MIN_FREQ && c.hz <= MAX_FREQ)
  if (!usable.length) return null

  if (fresh) {
    const grown = usable.filter(c => c.fresh)
    const p = pickMpm(grown, settings.mpmK)
    if (p && p.n >= settings.clarityThreshold) return { ...p, viaOnset: true }
  }

  if (state.smoothed !== null) {
    let best = null
    for (const c of usable) {
      if (c.n < settings.clarityTrack) continue
      if (Math.abs(cents(c.hz, state.smoothed)) > settings.rejectThreshold) continue
      if (!best || c.n > best.n) best = c
    }
    if (best) return { ...best, viaOnset: false }
  }

  const p = pickMpm(usable, settings.mpmK)
  if (p && p.n >= settings.clarityThreshold) return { ...p, viaOnset: false }
  return null
}

/**
 * Advance the tracker by one analysis frame.
 *
 * frame: { candidates, rms, now, windowMs, fresh }
 *   candidates: [{ hz, n, support, fresh }] sorted by descending hz (may be empty)
 *   fresh: the detector saw a pluck within the last window and a half
 * returns { hz, gate, pick } where gate says what this frame did:
 *   'noise' | 'clarity' | 'outlier' | 'pending' | 'hold' | 'ok'
 * and pick is the candidate used (null when none qualified).
 */
export function trackPitch(state, frame, settings, strings) {
  const { candidates = [], rms, now, windowMs = 0, fresh = false } = frame
  const dtMs = state.lastFrameAt === null ? 0 : now - state.lastFrameAt
  state.lastFrameAt = now

  let gate
  let pick = null
  if (!(rms >= effectiveGate(state, settings))) gate = 'noise'
  else {
    pick = choose(candidates, state, settings, fresh)
    gate = pick ? 'ok' : 'clarity'
  }
  updateFloor(state, rms, dtMs, settings, gate === 'ok')

  if (gate === 'ok') {
    const obs = resolveOctave(pick.hz, state.smoothed, strings)

    if (state.smoothed === null) {
      commit(state, obs, [obs], now)
    } else if (Math.abs(cents(obs, state.smoothed)) <= settings.rejectThreshold) {
      // Right after a pluck the readings glide down from the sharp attack, and a
      // median over them is pure lag: it kept the needle 30 cents high while the
      // reading itself was already within 10. The median earns its place once the
      // note is parked, so the buffer restarts from the latest reading until then.
      if (pick.viaOnset) state.raw = []
      state.raw.push(obs)
      if (state.raw.length > MEDIAN_WINDOW) state.raw.shift()
      const target = median(state.raw)
      // Adaptive: move fast while the pitch is travelling (a peg being turned),
      // slow once it parks. A single alpha has to choose between feeling instant
      // and reading steady; two let us have both.
      const moving = pick.viaOnset || Math.abs(cents(target, state.smoothed)) > settings.fastGateCents
      const base = moving ? settings.smoothFactorFast : settings.smoothFactor
      state.smoothed += (target - state.smoothed) * emaAlpha(base, dtMs)
      state.pending = []
      state.pendingSince = null
      state.lastAcceptedAt = now
    } else {
      // Disagrees with the note we are holding. Never discarded outright: collect
      // it and let a sustained reading win. This is what removes the old permanent
      // dead zone — no distance from the current note is unreachable any more.
      const last = state.pending[state.pending.length - 1]
      if (last && now - last.at > PENDING_IDLE_MS) {
        state.pending = []
        state.pendingSince = null
      }
      // Space samples by half a window so they are not three reads of one
      // measurement: consecutive analyses of an 8192-sample window share ~85% of
      // their samples, and a transient lasting one window would sail through.
      const spacing = windowMs / 2
      const previous = state.pending[state.pending.length - 1]
      if (!previous || now - previous.at >= spacing || pick.viaOnset) {
        state.pending.push({ hz: obs, at: now })
        if (state.pending.length > PENDING_MAX) state.pending.shift()
        if (state.pendingSince === null) state.pendingSince = now
      }

      // A reading attributed to a pluck we just saw is evidence enough on its own:
      // the confirmation run exists to keep a stray reading from displacing the
      // note, and a pluck is not a stray. The needle moves on the attack instead
      // of three reads later.
      const need = pick.viaOnset ? 1 : Math.max(2, settings.confirmFrames)
      const recent = state.pending.slice(-need)
      // The backstop must never fire before a legitimate confirmation could have:
      // at 16384 samples and confirmFrames 6, collecting the run alone takes 850 ms,
      // and a fixed 500 ms timeout would snap first and skip the spread check.
      const timeoutMs = Math.max(PENDING_TIMEOUT_MS, need * spacing * 1.5)
      const timedOut = state.pendingSince !== null && now - state.pendingSince >= timeoutMs

      if (recent.length >= need && spreadCents(recent.map(p => p.hz)) <= CONFIRM_SPREAD_CENTS) {
        const hz = recent.map(p => p.hz)
        commit(state, median(hz), hz, now)
      } else if (timedOut && state.pending.length) {
        const forced = median(state.pending.map(p => p.hz))
        commit(state, forced, [forced], now)
      } else {
        gate = state.pending.length >= 2 ? 'pending' : 'outlier'
      }
    }
  }

  // Checked on every frame, accepted or not. The old loop only ran this inside its
  // two failure branches, so a run of frames that passed clarity but were all
  // discarded refreshed nothing and cleared nothing: the reading stayed pinned to a
  // stale note for as long as the string kept ringing.
  if (state.smoothed !== null && now - state.lastAcceptedAt >= settings.holdMs) {
    clearNote(state)
    gate = 'hold'
  }

  return { hz: state.smoothed, gate, pick }
}
