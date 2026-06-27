const INSTRUMENTS = [
  { id: 'guitar6',  label: 'Guitar 6' },
  { id: 'guitar12', label: 'Guitar 12' },
  { id: 'ukulele',  label: 'Ukulele' },
]

export default function InstrumentTabs({ active, onChange }) {
  return (
    <div className="relative flex-1">
      <select
        value={active}
        onChange={e => onChange(e.target.value)}
        aria-label="Instrument"
        className="appearance-none w-full h-9 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-lg pl-3 pr-8 border border-zinc-200 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer transition-colors font-medium"
        style={{ fontSize: '13px' }}
      >
        {INSTRUMENTS.map(inst => (
          <option key={inst.id} value={inst.id}>{inst.label}</option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}
