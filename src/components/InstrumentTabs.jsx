const INSTRUMENTS = [
  { id: 'guitar6',  label: 'Guitar 6-string' },
  { id: 'guitar12', label: 'Guitar 12-string' },
  { id: 'ukulele',  label: 'Ukulele' },
]

export default function InstrumentTabs({ active, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500 uppercase tracking-widest">Instrument</label>
      <select
        value={active}
        onChange={e => onChange(e.target.value)}
        className="bg-zinc-800 dark:bg-zinc-900 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
      >
        {INSTRUMENTS.map(inst => (
          <option key={inst.id} value={inst.id}>{inst.label}</option>
        ))}
      </select>
    </div>
  )
}
