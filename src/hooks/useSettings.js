import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'

export const SETTINGS_VERSION = 2

export const SETTINGS_DEFAULTS = {
  diapason:          440,
  noiseGate:         0.001,
  clarityThreshold:  0.90,
  smoothFactor:      0.15,
  holdMs:            1500,
  inTuneThreshold:   5,
  displaySmooth:     0.12,
  rejectThreshold:   75,
  resetThreshold:    100,
  _v:                SETTINGS_VERSION,
}

export function useSettings() {
  const [settings, setSettings] = useLocalStorage('egt-settings', SETTINGS_DEFAULTS)

  // One-time migration: builds before v2 shipped clarityThreshold 0.98 — the strictest
  // value the slider allows. High/thin strings (esp. the 12-string octave courses) never
  // reached it and read as silence. Pull anyone on an older version up to the corrected
  // detection default while preserving their other preferences (diapason, in-tune zone…).
  useEffect(() => {
    if (settings._v !== SETTINGS_VERSION) {
      setSettings(prev => ({
        ...prev,
        clarityThreshold: SETTINGS_DEFAULTS.clarityThreshold,
        _v: SETTINGS_VERSION,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function resetAll() {
    setSettings(SETTINGS_DEFAULTS)
  }

  // Fill in any missing keys (e.g. after adding new settings)
  const merged = { ...SETTINGS_DEFAULTS, ...settings }

  return { settings: merged, update, resetAll }
}
