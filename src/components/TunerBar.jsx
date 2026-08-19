export default function TunerBar({ cents, note, freq, inTune = false, zoneCents = 3, displaySmooth = 0.22, barRange = 25 }) {
  // Needle smoothing is purely visual: a CSS `left` transition retargeted on every
  // update. Duration maps the displaySmooth EMA alpha to its per-frame time
  // constant, so the number, color, arrows and needle all derive from the same
  // tracked pitch — the detector has already done the real smoothing. `inTune`
  // arrives already latched from App, which is what also drives the headstock ring
  // and the success beep, so the three can no longer disagree with each other.
  const needleMs = Math.round(16.7 * (1 / displaySmooth - 1))
  const hasSignal = note !== null && note !== undefined
  const displayCents = hasSignal ? (cents ?? 0) : 0

  const clampedCents = Math.max(-barRange, Math.min(barRange, displayCents))
  const pct = ((clampedCents + barRange) / (barRange * 2)) * 100
  const isSharp = hasSignal && !inTune && displayCents > 0
  const isFlat  = hasSignal && !inTune && displayCents < 0

  // Real cents, to the cent. The old ±10 scale rounded to 5-cent steps, so a
  // string three cents out looked perfectly in tune.
  const displayCentsInt = Math.round(displayCents)
  const ticks = [-barRange, -Math.round(barRange / 2), 0, Math.round(barRange / 2), barRange]

  const sig = !hasSignal ? 'zinc' : inTune ? 'emerald' : isSharp ? 'amber' : 'sky'
  const indicatorBg = { zinc: '#a1a1aa', emerald: '#10b981', amber: '#fbbf24', sky: '#38bdf8' }[sig]
  const indicatorGlow = {
    zinc: 'none', emerald: '0 0 12px rgba(16,185,129,0.65)',
    amber: '0 0 11px rgba(251,191,36,0.6)', sky: '0 0 11px rgba(56,189,248,0.6)',
  }[sig]

  const unitColor = !hasSignal ? 'text-zinc-400 dark:text-zinc-600'
    : inTune  ? 'text-emerald-500 dark:text-emerald-400'
    : isSharp ? 'text-amber-500 dark:text-amber-400'
    : 'text-sky-500 dark:text-sky-400'

  return (
    <div className="egt-enter flex flex-col gap-2.5">
      {/* Note name + cents deviation + frequency */}
      <div className="flex items-end justify-center gap-3">
        <span className={`text-6xl font-bold tabular-nums leading-none transition-colors ${hasSignal ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700'}`}>
          {hasSignal ? note : '–'}
        </span>
        {hasSignal && (
          <div className="flex flex-col items-start mb-1 w-16">
            <span className={`text-lg font-semibold tabular-nums leading-none transition-colors ${unitColor}`}>
              {displayCentsInt > 0 ? '+' : ''}{displayCentsInt}
              <span className="text-[11px] font-normal ml-0.5">¢</span>
            </span>
            {freq ? (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 tabular-nums mt-1">
                {freq.toFixed(1)} Hz
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Tuner bar */}
      <div className="relative h-4 rounded-full bg-zinc-200 dark:bg-zinc-800/80 overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/5">
        {/* In-tune zone: drawn at the width the latched verdict is currently using,
            so an emerald dot is always inside it */}
        <div
          className="absolute inset-y-0 rounded-[3px] bg-emerald-500/20 ring-1 ring-inset ring-emerald-500/30"
          style={{
            width: `${(zoneCents / barRange) * 100}%`,
            left: `${50 - (zoneCents / barRange) * 50}%`,
          }}
        />

        {/* Tick marks */}
        {ticks.map(tick => {
          const isCenter = tick === 0
          const pctPos = ((tick + barRange) / (barRange * 2)) * 100
          return (
            <div
              key={tick}
              className={`absolute w-0.5 z-10 ${isCenter
                ? 'h-3 top-[2px] bg-zinc-400 dark:bg-zinc-500'
                : 'h-1.5 top-[5px] bg-zinc-300 dark:bg-zinc-600'}`}
              style={{ left: `calc(${pctPos}% - 1px)` }}
            />
          )
        })}

        {/* Indicator dot — glows in its signal color */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full z-20 ring-1 ring-black/10 dark:ring-white/20"
          style={{
            // Pinned at full scale the dot would sit half outside the bar and get
            // clipped; clamping keeps the whole dot visible at both ends.
            left: `clamp(1px, calc(${pct}% - 7px), calc(100% - 15px))`,
            backgroundColor: indicatorBg,
            boxShadow: indicatorGlow,
            transition: `background-color 75ms, box-shadow 75ms, left ${needleMs}ms linear`,
          }}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-600 px-0.5">
        <span className={isFlat ? 'text-sky-500 font-medium' : ''}>−{barRange}</span>
        <span className={`font-semibold tracking-wide ${inTune ? 'text-emerald-500' : ''}`}>
          {/* With the mic on and nothing playing there is nothing to tune down: the
              old ternary fell through to "tune down" and pointed the user at a
              string that was never measured. */}
          {!hasSignal ? 'listening…' : inTune ? '✓ IN TUNE' : isFlat ? '▲ tune up' : '▼ tune down'}
        </span>
        <span className={isSharp ? 'text-amber-500 font-medium' : ''}>+{barRange}</span>
      </div>
    </div>
  )
}
