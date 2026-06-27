const INSTRUMENTS = [
  { id: 'guitar6',  label: 'Guitar 6' },
  { id: 'guitar12', label: 'Guitar 12' },
  { id: 'ukulele',  label: 'Ukulele' },
]

export default function InstrumentTabs({ active, onChange }) {
  return (
    <select
      value={active}
      onChange={e => onChange(e.target.value)}
      aria-label="Instrument"
      className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer"
      style={{ fontSize: '13px' }}
    >
      {INSTRUMENTS.map(inst => (
        <option key={inst.id} value={inst.id}>{inst.label}</option>
      ))}
    </select>
  )
}
