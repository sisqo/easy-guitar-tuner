// Resolves the settings a bench run uses, from a preset name and/or a JSON blob:
//
//   node scripts/pipeline-bench.mjs                                  # defaults
//   PRESET=steady node scripts/pipeline-bench.mjs                    # a built-in
//   SETTINGS='{"clarityThreshold":0.7}' node scripts/pipeline-bench.mjs
//   PRESET=noisy SETTINGS='{"lpFreq":800}' node scripts/pipeline-bench.mjs
//
// PRESET is what closes the loop between the app and the benches: the presets the
// switcher offers are the same objects, so "this one felt better on the guitar"
// can be answered with the same numbers that chose the defaults.

import { SETTINGS_DEFAULTS, BUILTIN_PRESETS } from '../../src/data/settings.js'

export function resolveBenchSettings() {
  const name = process.env.PRESET
  let preset = {}
  if (name) {
    const found = BUILTIN_PRESETS.find(p => p.id === name)
    if (!found) {
      console.error(`Unknown preset "${name}". Known: ${BUILTIN_PRESETS.map(p => p.id).join(', ')}`)
      process.exit(1)
    }
    preset = found.values
  }
  const overrides = process.env.SETTINGS ? JSON.parse(process.env.SETTINGS) : {}
  return { ...SETTINGS_DEFAULTS, ...preset, ...overrides }
}

export function benchSettingsLabel() {
  const parts = []
  if (process.env.PRESET) parts.push(`preset ${process.env.PRESET}`)
  if (process.env.SETTINGS) parts.push(process.env.SETTINGS)
  return parts.length ? parts.join(' + ') : 'defaults'
}
