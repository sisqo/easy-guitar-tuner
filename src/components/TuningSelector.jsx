export default function TuningSelector({ tunings, active, onChange }) {
  return (
    <select
      value={active}
      onChange={e => onChange(e.target.value)}
      aria-label="Tuning"
      className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 cursor-pointer"
      style={{ fontSize: '13px' }}
    >
      {Object.entries(tunings).map(([key, t]) => (
        <option key={key} value={key}>{t.label}</option>
      ))}
    </select>
  )
}
