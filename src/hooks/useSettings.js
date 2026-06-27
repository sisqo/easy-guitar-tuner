import { useLocalStorage } from './useLocalStorage'

export const SETTINGS_DEFAULTS = {
  diapason:          440,
  noiseGate:         0.001,
  clarityThreshold:  0.98,
  smoothFactor:      0.15,
  holdMs:            1500,
  inTuneThreshold:   5,
  displaySmooth:     0.12,
  rejectThreshold:   75,
  resetThreshold:    100,
}

export function useSettings() {
  const [settings, setSettings] = useLocalStorage('egt-settings', SETTINGS_DEFAULTS)

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
