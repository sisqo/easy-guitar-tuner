export default function TuningSelector({ tunings, active, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500 uppercase tracking-widest">Tuning</label>
      <select
        value={active}
        onChange={e => onChange(e.target.value)}
        className="bg-zinc-800 dark:bg-zinc-900 text-zinc-100 text-sm rounded-lg px-3 py-2 border border-zinc-700 focus:outline-none focus:border-zinc-500 cursor-pointer"
      >
        {Object.entries(tunings).map(([key, t]) => (
          <option key={key} value={key}>{t.label}</option>
        ))}
      </select>
    </div>
  )
}
