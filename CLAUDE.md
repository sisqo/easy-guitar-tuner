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
                        →      detector.js  (NSDF candidates + spectrum: support, freshness, refined Hz)
                        →      pitchTracker (gate, candidate choice, confirmation, smoothing) → pitch Hz
                        →  findClosestString / getCents
                        →  TunerBar (display)
                        →  GuitarHeadstock (string buttons + lock + tuned markers)
```

`App.jsx` is the single stateful root. Persistent state uses `useLocalStorage` (`instrument`, `tuningKey`, `diapason`, `dark`, and the two preset keys below). Transient state uses `useState`: `lockedStringId` (cleared on instrument/tuning change), `tunedStrings` (a `Set` of string IDs confirmed in tune, cleared on mic stop or instrument/tuning change), `settingsOpen`, `iosSheetOpen`.

`useLocalStorage`'s setter is stable and reads the current value through a ref. It has to be both: preset actions are `useCallback`s that outlive the render they were created in, and two writes can land in the same tick. Reading `stored` straight from the render closure broke renaming a preset — the update was applied to the library as it stood when the callback was created, which was before any preset existed.

All detection parameters live in `src/data/settings.js` (plain data, no React — so `scripts/` can import it) and are surfaced by `useSettings` (persisted to localStorage as `egt-settings`). They reach `usePitchDetector` via a `settingsRef` — a `useRef` kept current in a `useEffect` — so the loop reads the latest values every frame without restarting the AudioContext.

`inTune` is latched **once** in `App.jsx`, with `HYSTERESIS_CENTS` of slack, and passed to `TunerBar`, `GuitarHeadstock` and the beep. Do not recompute it per component: they used to each call `isInTune()` on raw cents and visibly disagreed at the zone boundary.

### Pitch detection pipeline

Split in three: `usePitchDetector` owns the audio graph and the loop, `src/utils/detector.js` turns a window of samples into a list of **candidates**, and `src/utils/pitchTracker.js` is a **pure** state machine that chooses among them and owns every decision. Both utils are plain JS with no React or Web Audio, so `scripts/` can drive them with synthetic signals — see "Verifying detection changes".

**Audio graph** (wired once in `start()`, never rewired, so no setting change restarts the AudioContext):

```
getUserMedia → highpass(hpFreq, Q 0.7) → lowpass(lpFreq, Q 0.7) → AnalyserNode(windowSize)
```

Only the filter `frequency.value`s are live-adjustable. The lowpass keeps upper partials from tempting the period search into the half-period peak; the highpass removes rumble and DC. Measured effect: broadband noise at 0.02 amplitude arrives at the analyser as 0.0027 RMS.

**Loop**: `requestAnimationFrame`, but analysis is throttled to `ANALYSIS_INTERVAL_MS` (30 ms). At 8192 samples the buffer only turns over every 171 ms, so running the detector 60×/s is ~85% redundant FFT work. `setPitch` fires only when the reading moved ≥ `PUBLISH_CENTS` (0.3), so a parked string stops re-rendering the tree entirely.

**Detector** (`Detector.analyse(buffer, sampleRate, now, gateLevel)` → `{ rms, fresh, candidates }`). It does *not* return one pitch. It returns every key maximum of McLeod's NSDF that lies in 60–660 Hz (`MIN_FREQ`/`MAX_FREQ` live here) with height ≥ 0.3, sorted by descending frequency, and annotates each from a Hann power spectrum of the same window:

- `n` — the NSDF height, i.e. how much of the window's energy repeats at that period. With another string ringing under the note it is that note's *share* of the energy, not a measure of noise.
- `support` — the candidate's fundamental or 2nd harmonic is a real spectral peak (a local maximum, not the skirt of a neighbour's lobe) within 30 dB of the strongest partial. The common subharmonic of two strings (E2 + A2 repeat every 36 ms) has none.
- `fresh` — after a pluck, the fundamental's power *grew* by ≥ 50% against the spectrum from before the pluck. A pluck is an RMS rise of ≥ 1.35× against one window ago (`ONSET_RATIO`); the reference spectrum is the frame one window back, and stays the reference for 1.5 windows (`FRESH_WINDOWS`). What grew is what the user just played; the string still ringing from before did not.
- `hz` — the frequency re-estimated from the candidate's own first partials with Grandke's interpolator (exact for a Hann window), weighted by (magnitude × k)² and de-emphasised beyond h2 because string stiffness reads higher partials sharp. The NSDF peak of the note being tuned is pulled by whatever else is ringing; its partials are not. Falls back to the NSDF value (`hzNsdf`) when no partial peak is found.

This replaced pitchy's `PitchDetector`, whose single answer — first peak ≥ k × tallest — sat on the shared subharmonic as soon as a previous string held more than ~10% of the energy. Measured on a simulated session plucking the six strings 0.7 s apart without muting, that showed nothing at all for five of them. `fft.js` (which pitchy used internally) is now a direct dependency.

**Tracker** (`trackPitch(state, { candidates, rms, fresh, now, windowMs }, settings, strings)` → `{ hz, gate, pick }`), in order:

1. **Noise gate** — `rms < effectiveGate()` → `gate: 'noise'`. The gate is the larger of `noiseGate` (absolute) and 1.6× a learned floor. The floor drops to any quieter frame at once, rises at most 50%/s and only on frames that yielded no note, and starts at `noiseGate` rather than the first frame's level — so the room is learned in a couple of seconds, a ringing note never becomes the floor, and opening the app mid-note does not teach it that the note is the room. The hook passes the gate to the detector so the period search is skipped below it (the frame is still logged for onset detection).
2. **Choice** (`choose`) among candidates with `support`, three regimes tried in order. *Fresh pluck*: only `fresh` candidates are eligible and McLeod's rule (`pickMpm`: highest frequency with `n ≥ mpmK × tallest`) picks among them, at `clarityThreshold`. *Continuation*: the best candidate within `rejectThreshold` of the held note, down to `clarityTrack` — a decaying string loses clarity long before it stops being the same note. *Cold start / no match*: McLeod's rule over everything supported, at `clarityThreshold`. Nothing qualifies → `gate: 'clarity'`.
3. **Octave resolution** (`resolveOctave`) on the pick — unchanged: trusted if within 35 cents of a string (keeps a 12-string's E3 off its own ÷2), otherwise ÷2/×2 only onto a string, nearest to the reference.
4. **Accept or confirm** — within `rejectThreshold` of the current note → median-of-5, then adaptive EMA. Beyond it → `pending`, and a run of `confirmFrames` agreeing readings (spaced half a window apart) replaces the note, with a `PENDING_TIMEOUT_MS` backstop so nothing is ever unreachable. **A pick attributed to a pluck (`viaOnset`) needs one reading**: the confirmation run exists to stop a stray from displacing the note, and a pluck is not a stray. During the fresh period the median buffer restarts from the latest reading and the fast alpha applies, because the readings glide down from the sharp attack and a median over them is pure lag (it kept the needle 30 cents high while the reading was already within 10).
5. **Hold** — evaluated on **every** frame, accepted or not; the note is cleared `holdMs` after the last accepted frame. When this lived only inside the failure branches a run of discarded frames pinned the display to a stale note for as long as the string rang.

**Adaptive smoothing**: `smoothFactorFast` while the pitch moves more than `fastGateCents` (or the frame is fresh), `smoothFactor` once it parks. The alpha is defined at 60 fps and rescaled by the real frame interval (`emaAlpha`), so the time constant does not double on a 30 fps phone.

`mpmK` is McLeod's *k*: which NSDF peak counts as the period, as a fraction of the tallest in range. It governs octave selection; the clarity settings only decide whether a chosen candidate is trusted.

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
| `noiseGate` | 0.001 | Absolute RMS floor after the filters; the adaptive gate sits above it |
| `clarityThreshold` | 0.55 | NSDF height to show a note not already on screen |
| `clarityTrack` | 0.45 | NSDF height to keep following the note on screen |
| `mpmK` | 0.90 | McLeod's period selection *k* (octave control) |
| `smoothFactor` | 0.18 | EMA alpha at 60 fps, pitch parked |
| `smoothFactorFast` | 0.45 | EMA alpha, pitch moving |
| `fastGateCents` | 12 | Movement threshold for the fast alpha |
| `rejectThreshold` | 45 | Beyond this a reading needs confirming |
| `confirmFrames` | 3 | Agreeing readings to accept a new note |
| `holdMs` | 1200 | Note hold after silence (ms) |
| `debugOverlay` | false | Show `DebugOverlay` under the bar |

`windowSize` 8192 is a measured choice, not a guess: on a clean signal 4096 is indistinguishable, but in a realistically noisy one 8192 cuts the jitter by 3–4× (low E 0.96¢ → 0.23¢ sd), and the spectral refinement needs the resolution. 16384 gains little for another 171 ms of latency. Re-run `node scripts/detector-bench.mjs` after touching any signal-chain default.

#### Presets

A preset is a named snapshot of the detection and display parameters, so a session with the guitar in hand can compare *more aggressive* against *more tolerant* by tapping a chip instead of remembering sixteen slider positions.

- **What travels**: `PRESET_KEYS`, aliased to `MIGRATED_KEYS` on purpose — both answer the same question, "is this a parameter of ours to retune, or the user's own preference?". `diapason` and `debugOverlay` are excluded, so switching preset never moves somebody's A or flips the overlay.
- **Full snapshots, not diffs**: a preset stores every one of `PRESET_KEYS`. A diff against the defaults would silently change meaning the next time a default is retuned, and an experiment that felt right last month has to still mean the same thing. Keys added later are filled in from `SETTINGS_DEFAULTS` on the read path.
- **Built-ins** (`BUILTIN_PRESETS`) are written as deltas from the defaults in source — readable and reviewable — and materialised into full snapshots at module load. `standard` / `reactive` / `steady` / `noisy`, read-only; editing one and saving forks it into a user preset. Their values were chosen from `pipeline-bench` runs, not taste: `reactive` trades 191 ms → 135 ms to first reading for 3× the parked jitter (that is the 4096 window), `steady` trims the parked jitter (0.05¢ → 0.03¢ sd) for 10 ms of first reading and 30 ms of settle, `noisy` stops room noise at the gate instead of at the clarity test and gives up quiet plucks late in the decay. 16384 was tried for `steady` and rejected — it dropped fast string switching to 96% correct and bought no steadiness.
- **State**: two localStorage keys, `egt-presets` (the user library) and `egt-preset-active` (the id). Separate because switching preset is the hot path and has no business rewriting the whole library JSON. "Modified" is **derived** — `PRESET_KEYS.some(k => settings[k] !== activeValues[k])` — never stored, so a preset can never claim to be applied when a slider says otherwise.
- **Version bumps**: do *not* bump `SETTINGS_VERSION` for a preset change; no default is moving. Each saved preset is stamped with the `_v` it was captured at, and on a future bump the active id falls back to `standard` while the library is left intact — otherwise a stale user preset stays applied over freshly retuned defaults.
- **Baseline**: `SettingsPanel` reverts each setting's ↺ to the *active preset's* value, threaded down through `BaselineContext`, not to `SETTINGS_DEFAULTS`. While experimenting, "undo this knob" means back to the preset you are working from; resetting to a default the preset never used would silently mix two configurations. The footer's "Reset to defaults" is the one caller that writes the whole settings object (reference pitch included), so it marks `standard` active rather than re-applying it on top.
- **Live switching**: every preset key is applied without restarting the AudioContext, `windowSize` included — the loop reallocates the `Detector` and buffer when it changes (`usePitchDetector.js`). Two consequences worth knowing when comparing presets mid-note: a switch that leaves `windowSize` alone keeps the tracker state, so the held note, the median buffer and the learned noise floor all carry over and the first `holdMs` after the switch is a hybrid; a switch that changes `windowSize` calls `createTrackerState()` and drops all three, including the learned floor, so the room is relearned over the next couple of seconds. Neither is new — that is what the `windowSize` slider has always done — but it means `reactive` (4096) is the one preset whose A/B is not instantaneous.

`clarityThreshold` 0.55 is deliberately moderate: a string plucked while the others ring holds only part of the window's energy, and which string it is gets decided by `fresh`/`support`, not by this number. At the old 0.82 the user had to mute everything else — or pluck again, harder — before anything moved.

### Verifying detection changes

```bash
node scripts/tracker-check.mjs    # tracker decisions on hand-built candidate lists, no audio
node scripts/detector-bench.mjs   # detector accuracy/jitter vs window size on single notes
node scripts/pipeline-bench.mjs   # whole chain on simulated tuning sessions (the one that matters)
```

`PRESET=steady node scripts/pipeline-bench.mjs` runs a built-in preset; `PRESET=noisy SETTINGS='{"lpFreq":800}' node ...` layers an override on top (`scripts/lib/bench-settings.mjs`). This is what closes the loop between the app and the benches — the presets the switcher offers are the same objects, so "this one felt better on the guitar" gets answered with the numbers that chose the defaults.

`pipeline-bench` is the acceptance test for detection changes: it synthesises plucked strings (`scripts/lib/synth.mjs`, shared by both benches) and runs filters → detector → tracker on sessions the single-note bench cannot see — the six strings plucked 0.7 s and 1.3 s apart without muting, plucks at decreasing strength, a phone mic's rolled-off low E, hum, silence — and reports time-to-display, time-to-settle, share of correct frames, false positives and parked jitter. `SETTINGS='{"clarityThreshold":0.7}' node scripts/pipeline-bench.mjs` tries an override. Its "first" and "settle" columns are dominated by the synthetic attack glide (45¢, τ 60 ms) plus the window; compare runs against each other, not against zero.

`tracker-check` sweeps step changes from 50 to 700 cents (the dead-zone regression) and hand-builds candidate lists for the cases the choice logic exists for: the string just plucked vs the taller shared subharmonic, unsupported peaks, continuation at low clarity, false onsets, the adaptive gate.

The synth accumulates phase per sample. An earlier version wrote `sin(2π·f(t)·t)`, whose instantaneous frequency carries a `t·f'(t)` term that read 4–5 cents flat for a few hundred ms — and was mistaken for detector bias. Do not verify precision in a headless browser: Chromium's fake capture device is not sample-accurate and adds a systematic offset of ~10 cents of its own. It is fine for *functional* checks (does the note switch, are there console errors) — use the real mic plus `debugOverlay` for anything about accuracy.

### Main layout (`App.jsx`)

Stack order in `<main>`:
1. **Mic button** + `AutoToggle` chip — primary action row (instrument and tuning are `<select>`s inside `HamburgerMenu`, not in the main stack)
2. **`PresetSelector`** — the detection-preset chip and its popover. On the tuner screen rather than behind Settings because comparing two sets of parameters is only useful if it costs one tap with a guitar in your hands; saving and reverting live in the popover too, since walking to a side panel to keep a setting you just found is how you lose it. Its wrapper carries `z-30` so the popover covers the tuner card. `PresetManager` (rename, delete, and the same save/revert) sits at the top of `SettingsPanel`.
3. **Tuner panel** — one card: empty state (mic off) or live `TunerBar`, then `DebugOverlay` when enabled, then the tuned-string progress dots, then `GuitarHeadstock`

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
