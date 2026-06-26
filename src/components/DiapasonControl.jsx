export default function DiapasonControl({ value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500 uppercase tracking-widest">
        Reference <span className="text-zinc-300 font-semibold">{value} Hz</span>
      </label>
      <input
        type="range"
        min={430}
        max={450}
        step={1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500 cursor-pointer"
      />
      <div className="flex justify-between text-xs text-zinc-600">
        <span>430</span>
        <span>440</span>
        <span>450</span>
      </div>
    </div>
  )
}
