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
tunings.js  →  App.jsx  →  usePitchDetector (pitch Hz)
                        →  findClosestString / getCents
                        →  TunerBar (display)
                        →  GuitarHeadstock (string buttons + lock)
```

`App.jsx` is the single stateful root. All persistent settings (`instrument`, `tuningKey`, `diapason`, `dark`) use `useLocalStorage`. The `lockedStringId` (which string is pinned for manual tuning) is transient `useState` — cleared on instrument/tuning change.

### Pitch detection pipeline (`usePitchDetector`)

Runs a `requestAnimationFrame` loop on a 4096-sample `AnalyserNode` (no smoothing). Each frame goes through these gates in order:

1. **Noise gate** — RMS < 0.004 → hold or clear
2. **Clarity + range** — pitchy clarity ≥ 0.88, frequency 70–660 Hz
3. **Outlier rejection** — jump 30–100 cents from smooth → discard
4. **Octave correction** — jump > 100 cents → try ÷2/×2; if the corrected value is ≤ 30 cents away, it's an octave error, not a string change
5. **Reset** — jump > 100 cents and not an octave error → new string
6. **EMA smooth** — SMOOTH_FACTOR 0.15

After a valid reading, the last pitch is held for 1500 ms (`HOLD_MS`) to survive string decay.

### Tuning data (`src/data/tunings.js`)

All frequencies are derived at runtime from `noteFreq(note, octave, diapason)` so that changing the diapason (default 440 Hz) instantly recalculates everything. The `getTunings(diapason)` function returns the full instrument/tuning tree.

String ordering in arrays: **lowest pitch first** (index 0 = thickest string). The headstock layout maps these indices to physical peg positions.

### Headstock SVG (`GuitarHeadstock.jsx`)

`LAYOUTS` keyed by string count (4 / 6 / 12). Each layout defines:
- `leftIndices` / `rightIndices` — which string indices appear on each side of the headstock, **top-to-bottom**
- `nutXs` — x positions of each string at the nut, indexed by string position
- `leftPegs` / `rightPegs` — peg `{x, y}` coordinates

String routing uses cubic Bézier paths from nut to peg. Buttons outside the headstock trigger `onStringSelect(stringId)` to toggle the lock.

**12-string layout**: bass courses (E, A, D) on the left side; treble courses (G, B, high e) on the right. Within each course pair the lower-pitched string is listed first (top peg).

### Display scale

`TunerBar` shows cents mapped to a **−10 … +10 display scale** (divide actual cents by 5). The physical bar still spans ±50 cents; only the labels change. Color coding: flat = sky blue, sharp = amber, in tune = emerald.

### Build-time constants

`vite.config.js` injects `__BUILD_COMMITS__` and `__BUILD_HASH__` via `execSync('git rev-list --count HEAD')` — use these globals directly in JSX for the footer, no import needed.
