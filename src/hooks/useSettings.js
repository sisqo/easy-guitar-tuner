import { useEffect } from 'react'
import { useLocalStorage } from './useLocalStorage'
import { SETTINGS_DEFAULTS, SETTINGS_VERSION, MIGRATED_KEYS, RETIRED_KEYS } from '../data/settings'

export { SETTINGS_DEFAULTS, SETTINGS_VERSION }

export function useSettings() {
  const [settings, setSettings] = useLocalStorage('egt-settings', SETTINGS_DEFAULTS)

  // Stored preferences win over SETTINGS_DEFAULTS on the read path below, so
  // anyone who has already opened the app would keep their old detection values
  // and see none of a retuning. v2 shipped the parameters that made the tracker
  // hang on a stale note (the 75–100 cent discard band) and a 5-cent display
  // scale; v3 replaces the whole detection/display set. Personal preferences —
  // the reference pitch — are carried across untouched.
  useEffect(() => {
    if (settings._v !== SETTINGS_VERSION) {
      setSettings(prev => {
        const next = { ...prev }
        for (const key of MIGRATED_KEYS) next[key] = SETTINGS_DEFAULTS[key]
        for (const key of RETIRED_KEYS) delete next[key]
        next._v = SETTINGS_VERSION
        return next
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Bulk write, for applying a preset: one state update rather than sixteen, and
  // it deliberately merges — a preset only carries PRESET_KEYS, so the reference
  // pitch, the debug switch and `_v` survive a preset change untouched.
  function applyValues(values) {
    setSettings(prev => ({ ...prev, ...values }))
  }

  function resetAll() {
    setSettings(SETTINGS_DEFAULTS)
  }

  // Fill in any missing keys (e.g. after adding new settings)
  const merged = { ...SETTINGS_DEFAULTS, ...settings }

  return { settings: merged, update, applyValues, resetAll }
}
