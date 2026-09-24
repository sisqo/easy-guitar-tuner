---
name: EasyGuitarTuner
description: Chromatic tuner for guitar and ukulele — precise, fast, invisible.
source: claude.ai/design project "Tuner Mobile 2a" + "Logo" (1a)
colors:
  # CSS variables in src/index.css (.dark redefines them); Tailwind names in brackets
  bg-dark: "#0b0b0d"        # [canvas]
  bg-light: "#f5f5f3"
  surface-dark: "#141416"   # [surface] chips, buttons
  surface-light: "#ffffff"
  card-dark: "#18181b"      # [card] sheet rows, chip rest
  card-light: "#ffffff"
  well-dark: "#0e0e10"      # [well] segmented-control track
  well-light: "#efefec"
  sheet-dark: "#141416"     # [sheet] bottom sheets, settings
  sheet-light: "#fafaf9"
  line-dark: "#232327"      # [line] 1px borders
  line-light: "#e4e4e7"
  panel-from-dark: "#121214"
  panel-from-light: "#ffffff"
  panel-line-dark: "#1d1d21"
  panel-line-light: "#e4e4e7"
  ink-dark: "#f4f4f5"       # [ink]
  ink-light: "#18181b"
  ink-2-dark: "#a1a1aa"     # [ink-2]
  ink-2-light: "#52525b"
  muted-dark: "#71717a"     # [muted]
  muted-light: "#71717a"
  faint-dark: "#52525b"     # [faint]
  faint-light: "#a1a1aa"
  seg-off-dark: "#1f1f23"
  seg-off-light: "#e7e7ea"
  brand-teal: "#2aab9e"             # [brand]
  signal-in-tune: "#10b981"
  signal-flat: "#38bdf8"
  signal-sharp: "#fbbf24"
  signal-error: "#f87171"
  kofi: "#72a4f2"
typography:
  ui: "Geist 400/500/600"
  data: "Geist Mono 400/500"
  note: { font: Geist, size: 84px, weight: 500, tracking: "-0.04em" }
  cents: { font: Geist Mono, size: 26px, weight: 500 }
  wordmark: { font: Geist, size: 16px, weight: 600, tracking: "-0.02em" }
  body: { font: Geist, size: 13-14px, weight: 500 }
  meta: { font: Geist Mono, size: 11px }
rounded:
  segment: "3px"
  control: "12px"
  row: "14px"
  card: "16px"
  panel: "28px"
  full: "9999px"
---

# Design System: EasyGuitarTuner

## 1. Overview

**North star: "The Precision Instrument."** The app should feel like a good clip-on or pedal tuner: one reading, readable at arm's length, nothing that asks for attention while you tune. The redesign keeps that and gives it a calmer, more contemporary voice: a sans UI face, mono only for numbers, soft near-black surfaces, and one large panel that holds the reading and the headstock.

Dark is the default (stage, rehearsal room, practice at night); light is a full peer, not an afterthought. Both come from one set of CSS variables.

## 2. Colour

### Surfaces
A tight near-black ramp in dark (`#0b0b0d` → `#141416` → `#18181b`, borders `#232327`), warm off-white in light (`#f5f5f3` page, white surfaces). Depth comes from that ramp plus two very soft effects: a 1px inner highlight on panels (`--panel-inset`), and the tuner panel's gradient from `--panel-from` down into the page colour.

### Brand teal (`#2aab9e`)
Identity and selection, never signal: "Guitar" in the wordmark, the centre bar of the icon, a selected chip or preset (50% border, 8–12% fill), the chord root dot, the star of a pinned chord, the settings slider thumb. It never means "in tune" — that is emerald's job.

A faint teal wash sits behind the header (`radial-gradient` at 10%) as atmosphere.

### Signal
The three signal colours carry the whole tuning conversation and stay identical in both themes:

- **Emerald `#10b981`** — in tune, mic on, a string marked tuned, the Strum button.
- **Sky `#38bdf8`** — flat, and "locked" (the lock chip, a locked string with no reading).
- **Amber `#fbbf24`** — sharp.
- Text on light backgrounds uses darker inks of the same hues (`--flat-ink`, `--sharp-ink`, `--tuned-ink`) for contrast.
- **Grey `#a1a1aa`** — provisional: the reading right after a pluck, before it has settled.

## 3. Typography

- **Geist** for everything readable as UI: the note letter, labels, buttons, the wordmark.
- **Geist Mono** for data: cents, Hz, the octave digit next to the note, the bar's scale, the header subtitle (`Standard · EADGBE`), the build hash, chord-diagram marks.
- The note letter (84px, 500, −0.04em) is always the largest thing on screen; its octave sits beside it in 20px mono, muted.
- No uppercase-tracked labels any more, except the small amber `MODIFIED` badge on a preset.

## 4. Components

### Tuner panel
One card, 28px top corners, open at the bottom so the headstock's strings fade into the page. From the top:

1. **Status row** — dot + `Mic off` / `Listening · Auto` / `Listening · E2`; on the right, one dot per string (emerald once tuned), `n/N` and a small reset button, shown only once something is tuned.
2. **Reading** — note letter left; cents (signal-coloured, mono) and Hz right, plus "playing D#2" when the sounding note is not the target. With the mic off: a muted "–" and a "↑ Tap the mic" pill with a one-line hint.
3. **Segment bar** — 25 rounded segments (22px tall, 3px gap) spanning ±`barRange`. The reading lights one segment in its signal colour with a glow, plus a translucent trail back to the centre. The in-tune zone is tinted faint emerald; in tune, the centre segment lights solid emerald. Ticks and mono labels at the ends and at ±40% of the range. Below it, one status line: `▲ Tune up`, `▼ Tune down`, `✓ In tune`, `✓ E2 tuned`, `···` while settling.
4. **Headstock** (below).

An emerald radial wash fades in at the top of the panel while in tune.

### Headstock
A flat, dark wood headstock (subtle horizontal gradient + top sheen), bone nut and metal pegs, cropped just below the nut. String buttons are plain circles outside the wood: rest `--btn-fill`/`--btn-stroke`; active tinted in the signal colour at 14–16% with a 1.5px stroke; locked in sky. The active string takes the reading's colour and trembles slightly until it is in tune. A tuned string keeps a faint emerald ring and a small dot under its label; the moment it is marked, one emerald ring pulses off its button.

### Mic button
60px circle. Off: surface with a 1px border and a slow "breathing" halo, the one thing on screen that asks to be tapped. On: solid emerald with a 6px soft ring, an ambient glow and a ping.

### Chips and segmented controls
- **Chip** (instrument, tuning, root, quality): 1px `line` border on `card`; selected = teal border + teal tint, ink text. Instrument and root chips are 12px-radius tiles in a grid; tuning chips are pills.
- **Segmented** (Tuner | Chords, Browse | Pinned): a `well` track with 3px padding; the selected tab is a raised `tab-on` pill.
- **Auto chip** next to the mic: `● Auto detect` at rest; locked, a sky-tinted pill with a lock and the string name.

### Bottom sheets
Menu, preset picker and install steps all slide up from the bottom: 28px top corners, `sheet` background, a grabber, 50% black backdrop with a 2px blur. The menu holds Tuner/Chords, instrument and tuning chips, and a grouped list (Settings, light/dark, Add to Home Screen, Buy me a coffee). The preset sheet lists presets as 56px rows with a description and a teal check. When the settings differ from the active preset, an amber-tinted box above the list offers Save / Save as… / Revert.

### Chords
Root chips in a 6×2 grid, quick-quality chips (Major, Minor, 7) plus a "More" select dressed as a chip, then a panel with the chord name at 56px, the diagram, the voicing pager, and a star button + an emerald "Strum" pill.

### Header and footer
Header: 30px icon + wordmark + mono subtitle, centred; a 40px square menu button on the right. Footer: `by SisQo · Buy me a coffee · <hash>` in `faint`, Ko-fi link in its own blue.

### Icon
The segment bar as a mark: seven rounded bars on `#16161a` (23% corner radius), greys stepping up to a tall teal centre bar. At 40px and below, three bars. Home-screen and maskable versions are full-bleed squares.

## 5. Motion

Short and functional: segment fades (duration from `displaySmooth`, ~60ms), sheet slide-up (240ms), mic ping/breath, string tremble, tuned pulse (900ms). Everything that loops or pulses is off under `prefers-reduced-motion`.

## 6. Do's and Don'ts

**Do**
- Use the Tailwind theme names (`bg-surface`, `border-line`, `text-muted`…) or the CSS variables, never a `zinc-*` + `dark:` pair.
- Keep emerald, sky and amber for tuning state only (plus Strum and the mic, which are "go" actions).
- Keep the note letter the largest element and the number next to it exact to the cent.
- Put new secondary UI in a bottom sheet.

**Don't**
- Don't use teal to mean "in tune", or emerald for selection.
- Don't add a third typeface, or set prose in mono.
- Don't add shadows beyond the panel inset, the signal glows and the mic's ring.
- Don't make it look like a dashboard: no metric cards, no sidebars.
