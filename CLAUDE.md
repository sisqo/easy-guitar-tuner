# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## Commands

```bash
npm run dev        # start Vite dev server
npm run build      # production build (injects git commit count/hash via vite define)
npm run lint       # ESLint check
npm run preview    # serve the production build locally
```

**Node 18 caveat**: the build command includes `NODE_OPTIONS=--experimental-global-webcrypto` — required by vite-plugin-pwa/workbox on Node 18. Do not remove it.

**GitHub remote**: the repo lives at `github.com/sisqo/easy-guitar-tuner` (account: `sisqo`, not `flimberti`). Switch CLI auth with `gh auth switch --user sisqo` before pushing.

**Deployment**: Vercel auto-deploys from `main`. Production: `https://easy-guitar-tuner-eight.vercel.app`.

## Architecture

### Data flow

```
tunings.js  →  App.jsx  →  usePitchDetector (audio graph + loop)
                        →      pitchTracker (gates, octave, smoothing) → pitch Hz
                        →  findClosestString / getCents
                        →  TunerBar (display)
                        →  GuitarHeadstock (string buttons + lock + tuned markers)
```

`App.jsx` is the single stateful root. Persistent state uses `useLocalStorage` (`instrument`, `tuningKey`, `diapason`, `dark`). Transient state uses `useState`: `lockedStringId` (cleared on instrument/tuning change), `tunedStrings` (a `Set` of string IDs confirmed in tune, cleared on mic stop or instrument/tuning change), `settingsOpen`, `iosSheetOpen`.

All detection parameters live in `src/data/settings.js` (plain data, no React — so `scripts/` can import it) and are surfaced by `useSettings` (persisted to localStorage as `egt-settings`). They reach `usePitchDetector` via a `settingsRef` — a `useRef` kept current in a `useEffect` — so the loop reads the latest values every frame without restarting the AudioContext.

`inTune` is latched **once** in `App.jsx`, with `HYSTERESIS_CENTS` of slack, and passed to `TunerBar`, `GuitarHeadstock` and the beep. Do not recompute it per component: they used to each call `isInTune()` on raw cents and visibly disagreed at the zone boundary.

### Pitch detection pipeline

Split in two: `usePitchDetector` owns the audio graph and the loop, `src/utils/pitchTracker.js` is a **pure** state machine that owns every decision. The split exists so the decisions are testable without a microphone — see `scripts/tracker-check.mjs`.

**Audio graph** (wired once in `start()`, never rewired, so no setting change restarts the AudioContext):

```
getUserMedia → highpass(hpFreq, Q 0.7) → lowpass(lpFreq, Q 0.7) → AnalyserNode(windowSize)
```

Only the filter `frequency.value`s are live-adjustable. The lowpass is the defence against octave-up errors; the highpass removes rumble and DC. Measured effect: broadband noise at 0.02 amplitude arrives at the analyser as 0.0027 RMS, i.e. below the noise gate.

**Loop**: `requestAnimationFrame`, but analysis is throttled to `ANALYSIS_INTERVAL_MS` (30 ms). At 8192 samples the buffer only turns over every 171 ms, so running MPM 60×/s is ~80% redundant FFT work. `setPitch` fires only when the reading moved ≥ `PUBLISH_CENTS` (0.3), so a parked string stops re-rendering the tree entirely.

**`trackPitch` gates, in order:**

1. **Noise gate** — RMS < `noiseGate` → `gate: 'noise'`
2. **Clarity** — pitchy clarity < `clarityThreshold` → `gate: 'clarity'`
3. **Range** — outside 60–660 Hz → `gate: 'range'`. This is load-bearing: 50 Hz mains hum passes the clarity threshold on *every* frame (hum is perfectly periodic), and two strings ringing together produce a confident reading at their common subharmonic (E2 + A2 → ~27.5 Hz). The range check is what discards both — not clarity.
4. **Octave resolution** (`resolveOctave`) — the detected value is trusted if it already sits within 35 cents of a string, which is what keeps a 12-string's E3 off its own ÷2 = E2. Only otherwise are ÷2/×2 considered, and only ones that land on a string, so a slack low E 160 cents flat is not doubled onto D3. With a reference in hand the nearest alternative to it wins; with none, the raw value stands.
5. **Accept or confirm** — within `rejectThreshold` of the current note → median-of-5, then adaptive EMA. Beyond it → the reading joins `pending`, and only a run of `confirmFrames` agreeing readings (spaced half a window apart, so they are not three reads of one measurement) replaces the note. **Nothing is ever discarded outright**: no distance from the current note is unreachable, and a `PENDING_TIMEOUT_MS` backstop snaps even readings that never agree.
6. **Hold** — evaluated on **every** frame, accepted or not. This placement matters: when the check lived only inside the failure branches, a run of frames that passed clarity but were all discarded refreshed nothing and cleared nothing, and the display stayed pinned to a stale note for as long as the string rang. That was the "I have to pluck the string several times" bug.

**Adaptive smoothing**: `smoothFactorFast` while the pitch moves more than `fastGateCents`, `smoothFactor` once it parks. The alpha is defined at 60 fps and rescaled by the real frame interval (`emaAlpha`), so the time constant no longer doubles on a 30 fps phone.

`mpmK` is assigned to pitchy's own `detector.clarityThreshold` — a **setter with no getter**, so the applied value is tracked in a local. It is MPM's *k*, which decides which NSDF peak counts as the period: this, not `settings.clarityThreshold`, is the octave-error control.

### Settings (`src/data/settings.js`)

Stored in localStorage as `egt-settings`, version-gated by `SETTINGS_VERSION`. Stored values win over defaults on the read path, so **retuning a default does nothing for an existing user** — bump `SETTINGS_VERSION` and list the key in `MIGRATED_KEYS` (or `RETIRED_KEYS` to delete it). `diapason` is deliberately never migrated: it is a user preference, not a detection parameter.

| Key | Default | Description |
|-----|---------|-------------|
| `diapason` | 440 | A4 reference Hz |
| `inTuneThreshold` | 3 | In-tune zone (±cents) |
| `barRange` | 25 | TunerBar full scale (±cents) |
| `displaySmooth` | 0.22 | Needle glide only |
| `windowSize` | 8192 | `fftSize` — samples per analysis |
| `hpFreq` | 55 | Highpass Hz |
| `lpFreq` | 1200 | Lowpass Hz |
| `noiseGate` | 0.003 | Min RMS, measured after the filters |
| `clarityThreshold` | 0.82 | Min pitchy confidence |
| `mpmK` | 0.90 | pitchy's period selection (octave control) |
| `smoothFactor` | 0.18 | EMA alpha at 60 fps, pitch parked |
| `smoothFactorFast` | 0.45 | EMA alpha, pitch moving |
| `fastGateCents` | 12 | Movement threshold for the fast alpha |
| `rejectThreshold` | 45 | Beyond this a reading needs confirming |
| `confirmFrames` | 3 | Agreeing readings to accept a new note |
| `holdMs` | 1200 | Note hold after silence (ms) |
| `debugOverlay` | false | Show `DebugOverlay` under the bar |

`windowSize` 8192 is a measured choice, not a guess: on a clean signal 4096 is indistinguishable, but in a realistically noisy one 8192 roughly halves the jitter (low E 2.1¢ → 1.3¢ sd). 16384 gains little for another 171 ms of latency. Re-run `node scripts/detector-bench.mjs` after touching any signal-chain default.

### Verifying detection changes

```bash
node scripts/tracker-check.mjs    # tracker state machine, no mic needed
node scripts/detector-bench.mjs   # accuracy/jitter vs window size, offline
```

`tracker-check` sweeps step changes from 50 to 700 cents; that sweep is the regression test for the dead zone. Do not verify precision in a headless browser: Chromium's fake capture device is not sample-accurate and adds a systematic offset of ~10 cents of its own. It is fine for *functional* checks (does the note switch, are there console errors) — use the real mic plus `debugOverlay` for anything about accuracy.

### Main layout (`App.jsx`)

Stack order in `<main>`:
1. **Mic button** + `AutoToggle` chip — primary action row (instrument and tuning are `<select>`s inside `HamburgerMenu`, not in the main stack)
2. **Tuner panel** — one card: empty state (mic off) or live `TunerBar`, then `DebugOverlay` when enabled, then the tuned-string progress dots, then `GuitarHeadstock`

`GuitarHeadstock` is wrapped in `React.memo` — it is the heaviest node in the tree, and it must not re-render on every reading. That is why `handleLockToggle` is a `useCallback`; a fresh identity there would defeat the memo.

### AutoToggle

Inline chip component in `App.jsx` (not a separate file). Reads `lockedStringId`:
- `null` → shows `● Auto` (green dot)
- non-null → shows lock icon + string label (e.g. `E2`)

Tap when locked → `handleLockToggle(lockedStringId)` (unlocks). Tap when auto + active string → `handleLockToggle(activeStringId)` (locks). Updates automatically when user taps a headstock button.

### Tuned markers

When the beep fires (`beepFiredRef.current = true`), the active `stringId` is added to `tunedStrings` (a `Set`). `GuitarHeadstock` receives this set via the `tunedStrings` prop. A string with `tunedStrings.has(id) && !isActive` shows an emerald ring + `✓` checkmark (upper-right of button circle, animated with `.marker-appear` CSS keyframe in `index.css`). Cleared on mic stop, instrument change, or tuning change.

### Tuning data (`src/data/tunings.js`)

All frequencies are derived at runtime from `noteFreq(note, octave, diapason)` so that changing the diapason instantly recalculates everything. The `getTunings(diapason)` function returns the full instrument/tuning tree.

String ordering in arrays: **lowest pitch first** (index 0 = thickest string). The headstock layout maps these indices to physical peg positions.

### Headstock SVG (`GuitarHeadstock.jsx`)

`LAYOUTS` keyed by string count (4 / 6 / 12). Each layout defines:
- `leftIndices` / `rightIndices` — which string indices appear on each side, **top-to-bottom**
- `nutXs` — x positions of each string at the nut
- `leftPegs` / `rightPegs` — peg `{x, y}` coordinates

String routing uses cubic Bézier paths from nut to peg. Buttons sit outside the headstock rect (at `leftBtnX` / `rightBtnX`) and trigger `onStringSelect(stringId)` to toggle the lock.

**Visual**: headstock uses a maple wood gradient (`wood-h`) + grain pattern (`woodgrain`) + gloss varnish (`wood-shine`). Nut is bone/ivory. All SVG colors are conditional on the `dark` prop (passed from App.jsx) since Tailwind can't reach inside SVG.

**12-string layout**: bass courses (E, A, D) on the left; treble courses (G, B, high e) on the right. Within each course pair the lower-pitched string is listed first (top peg).

### Add to Home Screen (`useInstallPrompt`)

Hook captures `beforeinstallprompt` (Android Chrome), detects iOS Safari (`/iphone|ipad|ipod/i` + WebKit, not CriOS), and detects standalone mode. `showInstallOption` is `true` when not already installed and either native prompt is available or iOS is detected. On iOS, tapping the menu item opens an `iosSheetOpen` bottom sheet with 3-step Safari instructions.

### Display scale

`TunerBar` reads out **real cents, to the cent**, and both the bar and its labels span ±`barRange` (default 25). It used to show `Math.round(cents / 5)` on a fixed ±50 bar, which meant a string three cents out looked perfectly in tune — half of "not as precise as other tuners" was this, not the detector.

The needle is a CSS `left` transition retargeted on each update; `displaySmooth` only sets its duration. All the real smoothing happens in `pitchTracker`, so the number, the colour and the dot describe the same value.

Color: flat = sky-400 `#38bdf8`, sharp = amber-400 `#fbbf24`, in tune = emerald-500 `#10b981`.

### Build-time constants

`vite.config.js` injects `__BUILD_COMMITS__` and `__BUILD_HASH__` via `execSync('git rev-list --count HEAD')` — use these globals directly in JSX, no import needed.
