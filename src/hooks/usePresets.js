import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'
import {
  SETTINGS_DEFAULTS, SETTINGS_VERSION, BUILTIN_PRESETS, DEFAULT_PRESET_ID,
  PRESET_KEYS, presetValuesFrom,
} from '../data/settings'

// The library and the active id are two localStorage keys on purpose. Switching
// preset is the hot path — that is the whole feature — and it has no business
// rewriting the entire library JSON every time.
const LIBRARY_KEY = 'egt-presets'
const ACTIVE_KEY = 'egt-preset-active'

function newId() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// Presets saved before a key existed are filled in from the defaults, the same way
// useSettings merges stored settings — so a preset from an older version loads
// instead of leaving that parameter undefined.
function fullValues(preset) {
  return { ...presetValuesFrom(SETTINGS_DEFAULTS), ...preset.values }
}

export function usePresets(settings, applyValues) {
  const [library, setLibrary] = useLocalStorage(LIBRARY_KEY, [])
  const [storedActiveId, setActiveId] = useLocalStorage(ACTIVE_KEY, DEFAULT_PRESET_ID)

  const userPresets = Array.isArray(library) ? library : []
  const presets = [...BUILTIN_PRESETS, ...userPresets]

  // A user preset captured under older defaults must not stay silently applied over
  // freshly retuned ones — a version bump drops back to the built-in default and
  // leaves the library alone, so nothing the user saved is lost.
  const stored = presets.find(p => p.id === storedActiveId)
  const stale = stored && !stored.builtin && stored._v !== SETTINGS_VERSION
  const active = (stale || !stored) ? BUILTIN_PRESETS[0] : stored
  const activeId = active.id

  const activeValues = fullValues(active)

  // Derived, never stored: the settings themselves are the source of truth, so a
  // preset can never claim to be applied when a slider says otherwise.
  const dirty = PRESET_KEYS.some(key => settings[key] !== activeValues[key])

  const selectPreset = useCallback((id) => {
    const found = [...BUILTIN_PRESETS, ...(Array.isArray(library) ? library : [])].find(p => p.id === id)
    if (!found) return
    setActiveId(id)
    applyValues(fullValues(found))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library, applyValues])

  // Overwrite the active preset with what is on the sliders. Built-ins are ours,
  // not the user's, so this is a no-op on them and the UI offers "Save as" instead.
  const saveActive = useCallback(() => {
    if (active.builtin) return
    const values = presetValuesFrom(settings)
    setLibrary(prev => (prev ?? []).map(p => (p.id === active.id ? { ...p, values, _v: SETTINGS_VERSION } : p)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, settings])

  const saveAs = useCallback((label) => {
    const name = (label ?? '').trim() || 'My preset'
    const preset = { id: newId(), label: name, values: presetValuesFrom(settings), _v: SETTINGS_VERSION }
    setLibrary(prev => [...(prev ?? []), preset])
    setActiveId(preset.id)
    return preset.id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const revert = useCallback(() => {
    applyValues(activeValues)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyValues, active, library])

  const renamePreset = useCallback((id, label) => {
    const name = (label ?? '').trim()
    if (!name) return
    setLibrary(prev => (prev ?? []).map(p => (p.id === id ? { ...p, label: name } : p)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Deleting the preset you are on does not change how the tuner sounds: the
  // settings stay exactly where they are and the selector falls back to Standard,
  // which then honestly reads as modified.
  const deletePreset = useCallback((id) => {
    setLibrary(prev => (prev ?? []).filter(p => p.id !== id))
    if (id === storedActiveId) setActiveId(DEFAULT_PRESET_ID)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedActiveId])

  return {
    presets, userPresets, activeId, active, activeValues, dirty,
    selectPreset, saveActive, saveAs, revert, renamePreset, deletePreset,
    // Marks a preset active *without* applying it, for the one caller that has
    // already written the values itself — "reset to defaults" writes the whole
    // settings object, diapason included, which no preset is allowed to touch.
    setActivePreset: setActiveId,
  }
}
