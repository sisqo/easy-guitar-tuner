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
        className="bg-white text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-lg px-2 py-1.5 border focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer w-full"
        style={{ fontSize: '13px' }}
      >
        {INSTRUMENTS.map(inst => (
          <option key={inst.id} value={inst.id}>{inst.label}</option>
        ))}
      </select>
    </div>
  )
}
