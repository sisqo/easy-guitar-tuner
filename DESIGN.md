---
name: EasyGuitarTuner
description: Chromatic tuner for guitar and ukulele — precise, fast, invisible.
colors:
  bg-deep: "#09090b"
  surface: "#18181b"
  surface-raised: "#27272a"
  border: "#3f3f46"
  text-primary: "#f4f4f5"
  text-secondary: "#a1a1aa"
  text-muted: "#71717a"
  brand-teal: "#2aab9e"
  signal-in-tune: "#10b981"
  signal-flat: "#38bdf8"
  signal-sharp: "#fbbf24"
  signal-error: "#f87171"
typography:
  display:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, Fira Code, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-mic-active:
    backgroundColor: "{colors.signal-in-tune}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    size: "40px"
  button-mic-inactive:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    size: "40px"
  select-control:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  tuner-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
---

# Design System: EasyGuitarTuner

## 1. Overview

**Creative North Star: "The Precision Instrument"**

EasyGuitarTuner looks and feels like a piece of high-quality hardware — a standalone chromatic tuner pulled from a pedalboard, not an app downloaded from a store. The visual language is calibrated, not decorated. Every element is present because it does a job. Nothing is present to signal that a designer was here.

The aesthetic is dark because that is what dark means in this context: stage light, rehearsal room, practice at night. The surface palette spans `#09090b` to `#27272a` — a tight ramp of near-blacks that create depth through tonal layering rather than shadow. The single brand color, Calibration Teal, appears only where the instrument speaks: in the logo, in the brand name, and nowhere else on the neutral chrome.

The type is mono throughout — JetBrains Mono — because frequency values, cent readings, and note names are data, and data belongs in a monospaced face. The note name displayed at 3.75rem is the largest element on screen because it is the only thing the user needs to read in the moment of tuning.

**Key Characteristics:**
- Tonal depth without shadows — layers of near-black create surface hierarchy
- Mono-only typography — reinforces the instrument aesthetic, never casual
- Calibration Teal as a single accent, used with restraint
- Signal colors (emerald, sky, amber) carry the functional communication load
- No decorative chrome — every border, background, and color has a reason

## 2. Colors: The Instrument Palette

A near-monochrome dark palette with a single brand accent and a purpose-built signal vocabulary.

### Primary
- **Calibration Teal** (`#2aab9e`): The brand accent. Used for the word "Guitar" in the header logotype and drawn from the outer ring of the logo. Not an interactive affordance — a mark of identity. It appears once per screen.

### Secondary (none)
This system has no secondary accent. Secondary decoration is prohibited.

### Neutral
- **Deep Black** (`#09090b`): Page background. The darkest surface; sets the stage.
- **Surface** (`#18181b`): Card and panel backgrounds. One step lighter than the page — the primary content surface.
- **Surface Raised** (`#27272a`): Interactive element fills (selects, mic button rest state, tuner bar track). Distinguishable from Surface without requiring a border.
- **Border** (`#3f3f46`): Dividers, input outlines, card borders. Used at 1px — never as a decorative stripe.
- **Text Primary** (`#f4f4f5`): All primary readable text. Body copy, note names, values.
- **Text Secondary** (`#a1a1aa`): Supporting labels, secondary annotations.
- **Text Muted** (`#71717a`): De-emphasized labels (uppercase tracking text, scale tick labels).

### Signal
The signal colors carry the entire functional communication of the tuner. They are never decorative.

- **In-Tune Emerald** (`#10b981`): The target state. Active mic button, in-tune indicator, confirmed reading.
- **Flat Sky** (`#38bdf8`): Pitch is below the target. The bar leans left; the label glows blue.
- **Sharp Amber** (`#fbbf24`): Pitch is above the target. The bar leans right; the label glows amber.
- **Error Red** (`#f87171`): Microphone access denied or hardware error. Permission display only.

### Named Rules
**The One Accent Rule.** Calibration Teal appears once per screen — in the logotype. It is not an interactive color, not a hover state, not a highlight. Its rarity makes it recognizable. Do not use `#2aab9e` anywhere else.

**The Signal Monopoly Rule.** Emerald, sky, and amber exist only as tuner signal states. Do not use these colors for decorative purposes, success toasts, or any non-signal UI.

## 3. Typography

**Display / Body / Label Font:** JetBrains Mono (with Fira Code, monospace fallback)

**Character:** A single monospaced typeface used at all scales. This is intentional: the tuner displays numerical and musical data (note names, cent values, frequencies), and monospace ensures the data reads like instrument output, not UI copy. The constraint is the identity.

### Hierarchy
- **Display** (700, 3.75rem / 60px, line-height 1): The detected note name — "E4", "A3", "G#2". The hero of the screen. Used only for the live pitch readout.
- **Title** (700, 1.125rem / 18px, line-height 1): The app name in the header logotype.
- **Body** (400, 0.875rem / 14px, line-height 1.5): Option labels in selects, error messages, footer build info.
- **Label** (400, 0.75rem / 12px, tracking 0.1em, uppercase): Section labels ("Instrument", "Tuning", "Microphone"). Uppercase + tracked to distinguish from body without using a different weight.

### Named Rules
**The Mono-Only Rule.** No second typeface is ever introduced. Sans-serif, serif, and display faces are prohibited. The mono constraint carries the instrument aesthetic; breaking it breaks the identity.

## 4. Elevation

This system uses **tonal layering**, not shadows. Depth is created by stepping through the neutral ramp (`bg-deep` → `surface` → `surface-raised`) rather than floating elements with box-shadows.

The tuner card sits on `surface` (`#18181b`) against the `bg-deep` (`#09090b`) page — one step of contrast, no blur. Interactive controls use `surface-raised` (`#27272a`) to sit one additional step above the card. The mic button active state (emerald) provides the only true elevation signal: a soft ambient glow (`box-shadow: 0 0 20px rgba(16, 185, 129, 0.25)`) that appears only when the microphone is live.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. The only permitted shadow is the emerald ambient glow on the active mic button — a functional signal, not decoration. Add no other shadows.

## 5. Components

### Tuner Bar
The signature component. A thin, full-width horizontal track (`height: 16px, border-radius: 9999px`) in `surface-raised` with a circular indicator dot that moves left (flat/sky) or right (sharp/amber) from center. A subtle emerald zone (`±10%` width) marks the in-tune target. Tick marks at five positions (`−50, −25, 0, +25, +50` cents) are 1px wide, zinc-colored, never labeled with raw cent values — the `−10 … +10` display scale is shown in text below.

- **Track:** `height: 16px`, `background: #27272a`, `border-radius: 9999px`
- **Indicator:** `14px` circle, colored by signal state (zinc / emerald / sky / amber), `z-index` above ticks
- **In-tune zone:** 14% width strip centered, `background: rgba(16,185,129,0.20)`, `border: 1px solid rgba(16,185,129,0.40)`
- **State transitions:** `transition: colors 75ms` — fast enough to feel responsive, slow enough not to strobe

### Mic Button
A 40×40px circle. The primary call-to-action; centered below the selectors.

- **Inactive:** `background: #27272a`, `border: 2px solid #3f3f46`, icon `#a1a1aa`
- **Active:** `background: #10b981`, ambient glow, ping animation (opacity 30%), icon white
- **No text label.** The mic icon alone is the affordance. Labels were removed deliberately.
- **Hover:** Inactive → `#3f3f46`. Active → `#059669`.

### Select Controls (Instrument / Tuning)
Identical visual treatment side-by-side in a 2-column grid.

- **Background:** `#27272a`
- **Border:** `1px solid #3f3f46`
- **Border-radius:** `8px`
- **Text:** `#f4f4f5`, `0.875rem`, JetBrains Mono
- **Focus:** border shifts to `#52525b`; no glow, no outline ring
- **Labels above:** `0.75rem`, uppercase, `letter-spacing: 0.1em`, `color: #71717a`

### Header
Centered logotype with absolute-positioned ThemeToggle on the right. Logo (40×40px, `border-radius: 12px`) + title ("Easy**Guitar**Tuner" where "Guitar" is `#2aab9e`). Subtitle "Chromatic tuner" in `text-muted`.

### Headstock (Signature Component)
An SVG diagram of the guitar or ukulele headstock with string buttons. String buttons are interactive: tap to lock a string for manual tuning. Active strings glow with the signal color. 12-string layout: bass courses (E, A, D) on the left side; treble courses (G, B, high-e) on the right.

### Footer
Single-line, centered, `text-muted`: build number and commit hash. Purely informational — invisible in use, present for diagnostics.

## 6. Do's and Don'ts

### Do:
- **Do** use tonal layering (stepping through the neutral ramp) to create depth. No shadows except the mic button glow.
- **Do** reserve signal colors (emerald, sky, amber, red) exclusively for tuner state communication.
- **Do** use Calibration Teal (`#2aab9e`) only in the logotype. One instance per screen.
- **Do** keep the note name (display type, 3.75rem) as the largest typographic element at all times.
- **Do** use uppercase + letter-spacing only for section labels. Nowhere else.
- **Do** ensure the tuner bar indicator transitions in ≤100ms so pitch feel real-time.

### Don't:
- **Don't** introduce a second typeface. JetBrains Mono is the only permitted font family.
- **Don't** use `border-left` or `border-right` as a colored accent stripe on any component. Use background tints or full borders instead.
- **Don't** add gradient text, glassmorphism blur, or any decorative layer not present in the current system.
- **Don't** make this look like a SaaS dashboard: no metric cards, no sidebar navigation, no feature-section chrome, no platform-style layout.
- **Don't** use the signal colors (emerald, sky, amber) for non-signal purposes — not for success banners, hover highlights, or decorative accents.
- **Don't** add a second accent color. The system has one: Calibration Teal. Adding a second breaks the One Accent Rule and dilutes the identity.
- **Don't** add shadows to cards or panels at rest. The Flat-By-Default Rule is absolute.
