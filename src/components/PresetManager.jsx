import { useState } from 'react'

// The library side of presets: rename and delete, plus the same save/revert the
// selector offers, for when you are already in here moving sliders.

function ActionButton({ onClick, children, primary = false, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        primary
          ? 'bg-[#2aab9e] text-white border-[#2aab9e] hover:bg-[#249287]'
          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'
      }`}
    >{children}</button>
  )
}

function Row({ preset, active, onSelect, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(preset.label)
  const [confirming, setConfirming] = useState(false)

  function commit() {
    onRename(preset.id, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          aria-label="Preset name"
          className="flex-1 min-w-0 h-8 px-2.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-[#2aab9e]"
        />
        <button onClick={commit} className="h-8 px-2.5 rounded-lg text-xs font-semibold text-[#2aab9e] hover:bg-[#2aab9e]/10 transition-colors">OK</button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 py-1">
      <button
        onClick={() => onSelect(preset.id)}
        className={`flex-1 min-w-0 text-left text-sm truncate px-1 ${active ? 'font-semibold text-[#2aab9e]' : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100'} transition-colors`}
      >{preset.label}</button>
      {confirming ? (
        <>
          <button onClick={() => onDelete(preset.id)}
            className="h-7 px-2 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-colors">Delete</button>
          <button onClick={() => setConfirming(false)}
            className="h-7 px-2 rounded-lg text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">Keep</button>
        </>
      ) : (
        <>
          <button onClick={() => { setDraft(preset.label); setEditing(true) }} aria-label={`Rename ${preset.label}`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => setConfirming(true)} aria-label={`Delete ${preset.label}`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

export default function PresetManager({ preset }) {
  const { active, activeId, userPresets, dirty, selectPreset, saveActive, saveAs, revert, renamePreset, deletePreset } = preset
  const [naming, setNaming] = useState(false)
  const [draft, setDraft] = useState('')

  function startNaming() {
    setDraft(active.builtin ? `${active.label} copy` : `${active.label} 2`)
    setNaming(true)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Preset</h3>

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{active.label}</span>
        {dirty && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400 shrink-0">modified</span>
        )}
      </div>

      {naming ? (
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { saveAs(draft); setNaming(false) } if (e.key === 'Escape') setNaming(false) }}
            aria-label="New preset name"
            className="flex-1 min-w-0 h-8 px-2.5 rounded-lg text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-[#2aab9e]"
          />
          <ActionButton primary onClick={() => { saveAs(draft); setNaming(false) }}>Create</ActionButton>
          <button onClick={() => setNaming(false)}
            className="h-8 px-2 rounded-lg text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">Cancel</button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <ActionButton primary onClick={saveActive} disabled={active.builtin || !dirty}>Save</ActionButton>
          <ActionButton onClick={startNaming}>Save as…</ActionButton>
          <ActionButton onClick={revert} disabled={!dirty}>Revert</ActionButton>
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-600 leading-relaxed">
        A preset stores every value below except the reference pitch and the debug overlay. Switch between them from the tuner screen.
      </p>

      {userPresets.length > 0 && (
        <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 border-t border-zinc-100 dark:border-zinc-800 pt-1">
          {userPresets.map(p => (
            <Row
              key={p.id}
              preset={p}
              active={p.id === activeId}
              onSelect={selectPreset}
              onRename={renamePreset}
              onDelete={deletePreset}
            />
          ))}
        </div>
      )}
    </section>
  )
}
