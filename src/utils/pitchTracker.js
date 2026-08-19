// Pure pitch-tracking state machine: no React, no Web Audio, no timers of its own.
// Every decision the tuner makes about a raw reading happens here, so it can be
// driven from scripts/tracker-check.mjs with synthetic frame sequences instead of
// only being observable with a microphone in hand.

// 60 clears Drop C's low C2 (65.41 Hz at A440, 64.2 at A432) with headroom for a
// slack string being brought up. It also earns its keep twice over: measured on
// synthetic 50 Hz mains hum, every frame passes the clarity threshold — hum is
// beautifully periodic — and it is this range check, not clarity, that throws all
// of it away. Two strings ringing together land here too: the detector confidently
// reports their common subharmonic (E2 + A2 gives ~27.5 Hz), and showing nothing
// is the right answer to that.
export const MIN_FREQ = 60
export const MAX_FREQ = 660

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

export function cents(a, b) {
  return 1200 * Math.log2(a / b)
}

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

export function createTrackerState() {
  return {
    smoothed: null,
    raw: [],
    pending: [],
    pendingSince: null,
    lastAcceptedAt: null,
    lastFrameAt: null,
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

/**
 * Advance the tracker by one analysis frame.
 *
 * frame: { rawHz, clarity, rms, now, windowMs }
 * returns { hz, gate } where gate says what this frame did:
 *   'noise' | 'clarity' | 'range' | 'outlier' | 'pending' | 'hold' | 'ok'
 */
export function trackPitch(state, frame, settings, strings) {
  const { rawHz, clarity, rms, now, windowMs = 0 } = frame
  const dtMs = state.lastFrameAt === null ? 0 : now - state.lastFrameAt
  state.lastFrameAt = now

  let gate
  if (!(rms >= settings.noiseGate)) gate = 'noise'
  else if (!(clarity >= settings.clarityThreshold)) gate = 'clarity'
  else if (!(rawHz >= MIN_FREQ && rawHz <= MAX_FREQ)) gate = 'range'
  else gate = 'ok'

  if (gate === 'ok') {
    const obs = resolveOctave(rawHz, state.smoothed, strings)

    if (state.smoothed === null) {
      commit(state, obs, [obs], now)
    } else if (Math.abs(cents(obs, state.smoothed)) <= settings.rejectThreshold) {
      state.raw.push(obs)
      if (state.raw.length > MEDIAN_WINDOW) state.raw.shift()
      const target = median(state.raw)
      // Adaptive: move fast while the pitch is travelling (a peg being turned),
      // slow once it parks. A single alpha has to choose between feeling instant
      // and reading steady; two let us have both.
      const moving = Math.abs(cents(target, state.smoothed)) > settings.fastGateCents
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
      if (!previous || now - previous.at >= spacing) {
        state.pending.push({ hz: obs, at: now })
        if (state.pending.length > PENDING_MAX) state.pending.shift()
        if (state.pendingSince === null) state.pendingSince = now
      }

      const need = Math.max(2, settings.confirmFrames)
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

  return { hz: state.smoothed, gate }
}
