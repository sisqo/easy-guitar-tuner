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
                        →  GuitarHeadstock (string buttons + lock + tuned markers)
```

`App.jsx` is the single stateful root. Persistent state uses `useLocalStorage` (`instrument`, `tuningKey`, `diapason`, `dark`). Transient state uses `useState`: `lockedStringId` (cleared on instrument/tuning change), `tunedStrings` (a `Set` of string IDs confirmed in tune, cleared on mic stop or instrument/tuning change), `settingsOpen`, `iosSheetOpen`.

All detection parameters live in `useSettings` (persisted to localStorage as `egt-settings`) and are passed to `usePitchDetector` via a `settingsRef` — a `useRef` kept current in a `useEffect`. This lets the RAF loop read latest settings on every frame without restarting the AudioContext.

### Pitch detection pipeline (`usePitchDetector`)

Runs a `requestAnimationFrame` loop on a 4096-sample `AnalyserNode` (no smoothing). Each frame goes through these gates in order:

1. **Noise gate** — RMS < `noiseGate` (default 0.001) → hold or clear
2. **Clarity + range** — pitchy clarity ≥ `clarityThreshold` (default 0.90), frequency 70–660 Hz
3. **Outlier rejection** — jump `rejectThreshold`–`resetThreshold` cents from smooth → discard
4. **Octave correction** — jump > `resetThreshold` cents → try ÷2/×2; if the corrected value fits, it's an octave error not a string change
5. **Reset** — jump > `resetThreshold` and not an octave error → new string
6. **EMA smooth** — `smoothFactor` (default 0.15)

After a valid reading, the last pitch is held for `holdMs` (default 1500 ms) to survive string decay.

All parameters above are live-readable via `settingsRef.current` — changes take effect immediately without restarting the mic.

### Settings (`useSettings`)

Stored in localStorage as `egt-settings`. Defaults in `SETTINGS_DEFAULTS` (exported from `useSettings.js`):

| Key | Default | Description |
|-----|---------|-------------|
| `diapason` | 440 | A4 reference Hz |
| `noiseGate` | 0.001 | Min RMS to start detection |
| `clarityThreshold` | 0.90 | Min pitchy confidence |
| `smoothFactor` | 0.15 | EMA on raw pitch |
| `holdMs` | 1500 | Note hold after silence (ms) |
| `inTuneThreshold` | 5 | In-tune zone (±cents) |
| `displaySmooth` | 0.12 | TunerBar needle smoothing |
| `rejectThreshold` | 75 | Outlier gate (cents) |
| `resetThreshold` | 100 | String change threshold (cents) |

### Main layout (`App.jsx`)

Stack order in `<main>`:
1. **Selector row** — `InstrumentTabs` + `TuningSelector` (compact `<select>` with `flex-1`) + `AutoToggle` chip
2. **Mic button** — standalone centered block, primary action
3. **Tuner bar card** — empty state (mic off) or live `TunerBar`
4. **GuitarHeadstock** — SVG with string buttons and tuned markers

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

`TunerBar` shows cents mapped to a **−10 … +10 display scale** (divide actual cents by 5). The physical bar still spans ±50 cents; only the labels change. Color: flat = sky-400 `#38bdf8`, sharp = amber-400 `#fbbf24`, in tune = emerald-500 `#10b981`.

### Build-time constants

`vite.config.js` injects `__BUILD_COMMITS__` and `__BUILD_HASH__` via `execSync('git rev-list --count HEAD')` — use these globals directly in JSX, no import needed.
