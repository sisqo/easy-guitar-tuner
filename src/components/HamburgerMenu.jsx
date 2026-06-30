import { useState, useRef, useEffect } from 'react'

function MenuSelect({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          aria-label={label}
          className="appearance-none w-full h-9 bg-zinc-100 dark:bg-zinc-700/50 text-zinc-800 dark:text-zinc-100 rounded-lg pl-3 pr-8 border border-zinc-200 dark:border-zinc-600/70 hover:border-zinc-300 dark:hover:border-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer text-sm font-medium transition-colors"
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </label>
  )
}

const KOFI_URL = 'https://ko-fi.com/sisqo'

export default function HamburgerMenu({
  dark, onToggleTheme, onOpenSettings, showInstallOption, onInstall,
  instrument, instruments, onInstrumentChange, tuningKey, tunings, onTuningChange,
  view, onViewChange,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  function pickView(v) { setOpen(false); onViewChange(v) }

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      // Don't close while interacting with the native selects inside the menu
      if (e.target?.closest?.('select') || e.target?.tagName === 'OPTION') return
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [open])

  function handleSettings() { setOpen(false); onOpenSettings() }
  function handleTheme() { setOpen(false); onToggleTheme() }
  function handleInstall() { setOpen(false); onInstall?.() }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Menu"
        aria-expanded={open}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden z-50">
          {/* View switch — Tuner | Chords */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex p-1 gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-700/40">
              {[['tuner', 'Tuner'], ['chords', 'Chords']].map(([v, label]) => (
                <button key={v} onClick={() => pickView(v)}
                  className={`flex-1 h-8 rounded-md text-sm font-semibold transition-colors ${
                    view === v
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Instrument (+ tuning, only for the tuner) */}
          <div className="px-3 pt-1 pb-3 flex flex-col gap-2.5">
            <MenuSelect label="Instrument" value={instrument} onChange={e => onInstrumentChange(e.target.value)}>
              {instruments.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
            </MenuSelect>
            {view !== 'chords' && (
              <MenuSelect label="Tuning" value={tuningKey} onChange={e => onTuningChange(e.target.value)}>
                {Object.entries(tunings).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
              </MenuSelect>
            )}
          </div>

          <div className="h-px bg-zinc-100 dark:bg-zinc-700" />

          <button
            onClick={handleTheme}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>

          <div className="h-px bg-zinc-100 dark:bg-zinc-700 mx-3" />

          <button
            onClick={handleSettings}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>

          <div className="h-px bg-zinc-100 dark:bg-zinc-700 mx-3" />

          <a
            href={KOFI_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FF5E5B' }}>
              <path d="M2 3h18.5a1.5 1.5 0 0 1 0 3H19l-1.5 13A2 2 0 0 1 15.5 21h-7a2 2 0 0 1-2-1.8L5 7H2V3zm7.5 5a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5A.75.75 0 0 0 9.5 8zm3.5 0a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5A.75.75 0 0 0 13 8z"/>
            </svg>
            Buy me a coffee
          </a>

          {showInstallOption && (
            <>
              <div className="h-px bg-zinc-100 dark:bg-zinc-700 mx-3" />
              <button
                onClick={handleInstall}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/60 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Add to Home Screen
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
