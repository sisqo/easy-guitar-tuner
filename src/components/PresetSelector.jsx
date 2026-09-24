import { useState, useRef, useEffect, useCallback } from 'react'
import BottomSheet from './BottomSheet'

// The switcher itself, on the tuner screen rather than behind Settings: comparing
// two sets of detection parameters is only useful if it costs one tap with a guitar
// in your hands. Saving and reverting live here too — walking to a side panel to
// keep a setting you just found is how you lose it.

function Check({ on }) {
  return (
    <svg className="w-4 h-4 shrink-0 text-brand transition-opacity" style={{ opacity: on ? 1 : 0 }}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function GroupLabel({ children }) {
  return <div className="px-1 pt-1 text-xs font-medium text-muted">{children}</div>
}

const Modified = () => (
  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
    modified
  </span>
)

const primaryBtn = 'h-9 rounded-xl text-[13px] font-semibold bg-brand text-white hover:bg-[#249287] transition-colors cursor-pointer'
const secondaryBtn = 'h-9 rounded-xl text-[13px] font-medium border border-line bg-card text-ink-2 hover:text-ink transition-colors cursor-pointer'

export default function PresetSelector({
  presets, activeId, active, dirty, suggestedName, onSelect, onSave, onSaveAs, onRevert,
}) {
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  const close = useCallback(() => setOpen(false), [])

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
    setDraft(suggestedName)
    setNaming(true)
  }

  function confirmName() {
    onSaveAs(draft)
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`Detection preset: ${active.label}${dirty ? ', modified' : ''}`}
        className="w-full h-10 px-3 rounded-xl flex items-center gap-2 border border-line bg-surface text-ink hover:border-grabber transition-colors cursor-pointer"
      >
        <svg className="w-[15px] h-[15px] shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
        </svg>
        <span className="text-xs text-muted whitespace-nowrap">Preset</span>
        <span className="text-[13px] font-medium truncate">{active.label}</span>
        {dirty && <Modified />}
        <svg className="w-3.5 h-3.5 ml-auto shrink-0 text-faint" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <BottomSheet open={open} onClose={close} label="Detection preset" className="gap-3.5">
        <div className="flex flex-col gap-1 px-1">
          <span className="text-base font-semibold tracking-tight">Detection preset</span>
          <span className="text-xs text-muted">How the tuner listens. Switch any time.</span>
        </div>

        {dirty && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-3 flex flex-col gap-2.5">
            {naming ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmName(); if (e.key === 'Escape') { e.stopPropagation(); setNaming(false) } }}
                  aria-label="Preset name"
                  className="flex-1 min-w-0 h-9 px-3 rounded-xl text-sm bg-card text-ink border border-line focus:outline-none focus:border-brand"
                />
                <button onClick={confirmName} className={`${primaryBtn} px-4`}>Save</button>
                <button onClick={() => setNaming(false)} className="h-9 px-2 text-[13px] text-muted hover:text-ink cursor-pointer">Cancel</button>
              </div>
            ) : (
              <>
                <p className="text-xs text-ink-2 leading-snug">
                  {active.builtin
                    ? `Changed from ${active.label} — built-in presets can't be overwritten.`
                    : `Changed from the saved ${active.label}.`}
                </p>
                <div className="flex gap-1.5">
                  {!active.builtin && (
                    <button onClick={() => { onSave(); setOpen(false) }} className={`flex-1 ${primaryBtn}`}>Save</button>
                  )}
                  <button onClick={startNaming} className={`flex-1 ${active.builtin ? primaryBtn : secondaryBtn}`}>Save as…</button>
                  <button onClick={() => { onRevert(); setOpen(false) }} className={`flex-1 ${secondaryBtn}`}>Revert</button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {mine.length > 0 && <GroupLabel>Built-in</GroupLabel>}
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
      </BottomSheet>
    </>
  )
}

function PresetRow({ preset, active, dirty, onPick }) {
  return (
    <button
      onClick={() => onPick(preset.id)}
      aria-pressed={active}
      className={`w-full flex items-center gap-3 min-h-14 px-3.5 py-2 rounded-[14px] text-left border transition-colors cursor-pointer ${
        active ? 'border-brand/50 bg-brand/[0.08]' : 'border-line bg-card hover:border-grabber'
      }`}
    >
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink truncate">
          {preset.label}
          {active && dirty && <Modified />}
        </span>
        {preset.description && <span className="text-xs text-muted truncate">{preset.description}</span>}
      </div>
      <Check on={active} />
    </button>
  )
}
