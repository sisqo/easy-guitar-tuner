import { useState, useRef, useEffect } from 'react'

// The switcher itself, on the tuner screen rather than behind Settings: comparing
// two sets of detection parameters is only useful if it costs one tap with a guitar
// in your hands. Saving and reverting live here too — walking to a side panel to
// keep a setting you just found is how you lose it.

function Check() {
  return (
    <svg className="w-4 h-4 shrink-0 text-[#2aab9e]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function GroupLabel({ children }) {
  return (
    <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
      {children}
    </div>
  )
}

export default function PresetSelector({
  presets, activeId, active, dirty, onSelect, onSave, onSaveAs, onRevert,
}) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [open])

  useEffect(() => {
    if (!open) { setNaming(false); setDraft('') }
  }, [open])

  useEffect(() => {
    if (naming) inputRef.current?.focus()
  }, [naming])

  const builtins = presets.filter(p => p.builtin)
  const mine = presets.filter(p => !p.builtin)

  function pick(id) {
    setOpen(false)
    onSelect(id)
  }

  function startNaming() {
    setDraft(dirty && !active.builtin ? `${active.label} 2` : `${active.label} copy`)
    setNaming(true)
  }

  function confirmName() {
    onSaveAs(draft)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-label={`Detection preset: ${active.label}${dirty ? ', modified' : ''}`}
        className="w-full h-10 px-3 rounded-xl flex items-center gap-2 border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0 text-zinc-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
        </svg>
        <span className="text-sm font-medium truncate">{active.label}</span>
        {dirty && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400 shrink-0">
            modified
          </span>
        )}
        <svg className={`w-3.5 h-3.5 ml-auto shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden">
          {dirty && (
            <div className="px-3 pt-3 pb-2.5 border-b border-zinc-100 dark:border-zinc-700">
              {naming ? (
                <div className="flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') confirmName(); if (e.key === 'Escape') setNaming(false) }}
                    aria-label="Preset name"
                    className="flex-1 min-w-0 h-8 px-2.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-700/60 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-600 focus:outline-none focus:border-[#2aab9e]"
                  />
                  <button onClick={confirmName}
                    className="h-8 px-3 rounded-lg text-xs font-semibold bg-[#2aab9e] text-white hover:bg-[#249287] transition-colors">
                    Save
                  </button>
                  <button onClick={() => setNaming(false)}
                    className="h-8 px-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2 leading-snug">
                    {active.builtin
                      ? `Changed from ${active.label} — built-in presets can't be overwritten.`
                      : `Changed from the saved ${active.label}.`}
                  </p>
                  <div className="flex gap-1.5">
                    {!active.builtin && (
                      <button onClick={() => { onSave(); setOpen(false) }}
                        className="flex-1 h-8 rounded-lg text-xs font-semibold bg-[#2aab9e] text-white hover:bg-[#249287] transition-colors">
                        Save
                      </button>
                    )}
                    <button onClick={startNaming}
                      className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                        active.builtin
                          ? 'bg-[#2aab9e] text-white border-[#2aab9e] hover:bg-[#249287]'
                          : 'border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'
                      }`}>
                      Save as…
                    </button>
                    <button onClick={() => { onRevert(); setOpen(false) }}
                      className="flex-1 h-8 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors">
                      Revert
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto py-1">
            <GroupLabel>Built-in</GroupLabel>
            {builtins.map(p => (
              <PresetRow key={p.id} preset={p} active={p.id === activeId} dirty={dirty} onPick={pick} />
            ))}
            {mine.length > 0 && (
              <>
                <GroupLabel>Yours</GroupLabel>
                {mine.map(p => (
                  <PresetRow key={p.id} preset={p} active={p.id === activeId} dirty={dirty} onPick={pick} />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PresetRow({ preset, active, dirty, onPick }) {
  return (
    <button
      onClick={() => onPick(preset.id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
        active ? 'bg-[#2aab9e]/5 dark:bg-[#2aab9e]/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${active ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'font-medium text-zinc-700 dark:text-zinc-300'}`}>
          {preset.label}
          {active && dirty && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400">modified</span>}
        </div>
        {preset.description && (
          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">{preset.description}</div>
        )}
      </div>
      {active && <Check />}
    </button>
  )
}
