const TABS = [
  { id: 'guitar6',  label: 'Guitar 6' },
  { id: 'guitar12', label: 'Guitar 12' },
  { id: 'ukulele',  label: 'Ukulele' },
]

export default function InstrumentTabs({ active, onChange }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-zinc-800 dark:bg-zinc-900">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-1 py-2 px-3 rounded-lg text-sm font-semibold tracking-wide transition-all
            ${active === tab.id
              ? 'bg-zinc-100 dark:bg-zinc-100 text-zinc-900'
              : 'text-zinc-400 hover:text-zinc-200'}
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
