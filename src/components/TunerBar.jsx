const SEGMENTS = 25
const CENTER = (SEGMENTS - 1) / 2

const SIG = {
  zinc:    { c: '#a1a1aa', glow: 'none', trail: null },
  emerald: { c: '#10b981', glow: '0 0 12px rgba(16,185,129,0.6)', trail: 'rgba(16,185,129,0.25)' },
  amber:   { c: '#fbbf24', glow: '0 0 10px rgba(251,191,36,0.55)', trail: 'rgba(251,191,36,0.35)' },
  sky:     { c: '#38bdf8', glow: '0 0 10px rgba(56,189,248,0.55)', trail: 'rgba(56,189,248,0.3)' },
}

// "Eb2" → ["Eb", "2"]: the octave is set small beside the letter
function splitNote(label) {
  const m = /^(.*?)(\d+)$/.exec(label ?? '')
  return m ? [m[1], m[2]] : [label ?? '', '']
}

export default function TunerBar({
  listening, cents, note, targetLabel = null, soundingNote = null, freq, settling = false,
  inTune = false, zoneCents = 3, displaySmooth = 0.22, barRange = 25, flashLabel = null,
}) {
  // The segments step discretely, so displaySmooth now only sets how quickly a
  // segment fades between states. All the real smoothing is in pitchTracker, so
  // the number, the colour and the lit segment describe the same value. `inTune`
  // arrives already latched from App, which is what also drives the headstock
  // and the success beep, so the three can never disagree.
  const fadeMs = Math.round(16.7 * (1 / displaySmooth - 1))
  const hasSignal = listening && note != null
  const c = hasSignal ? (cents ?? 0) : 0

  // While a pluck is settling the reading is still on its way down from the
  // attack: the segment keeps moving, but grey and without an instruction, so a
  // string that is in fact flat is not called sharp first.
  const provisional = hasSignal && settling && !inTune
  const isSharp = hasSignal && !provisional && !inTune && c > 0
  const isFlat = hasSignal && !provisional && !inTune && c < 0
  const sig = !hasSignal || provisional ? 'zinc' : inTune ? 'emerald' : isSharp ? 'amber' : 'sky'

  // One segment per `step` cents, so the bar spans ±barRange whatever it is set to.
  const step = (barRange * 2) / SEGMENTS
  const k = Math.max(0, Math.min(SEGMENTS - 1, Math.round(c / step) + CENTER))
  // Tinted at the width the latched verdict is currently using, hysteresis
  // included — otherwise a string held green by the latch sits outside the band.
  const inZone = (i) => Math.abs(i - CENTER) * step <= zoneCents

  const segs = Array.from({ length: SEGMENTS }, (_, i) => {
    const rest = { c: inZone(i) ? 'var(--seg-zone)' : 'var(--seg-off)', glow: 'none' }
    if (!hasSignal) return rest
    if (inTune) {
      if (i === CENTER) return SIG.emerald
      return inZone(i) ? { c: SIG.emerald.trail, glow: 'none' } : rest
    }
    if (i === k) return SIG[sig]
    const between = (k < CENTER && i > k && i < CENTER) || (k > CENTER && i < k && i > CENTER)
    if (between && SIG[sig].trail) return { c: SIG[sig].trail, glow: 'none' }
    return rest
  })

  const tick = Math.round(barRange * 0.4)
  const tickPct = 50 - (tick / barRange) * 50

  const shown = hasSignal ? note : targetLabel
  const [letter, octave] = splitNote(shown)
  const noteColor = !hasSignal ? 'var(--note-idle)' : inTune ? 'var(--tuned-ink)' : 'var(--ink)'
  const ci = Math.round(c)

  let status = ''
  let statusColor = 'var(--muted)'
  if (!listening) status = ''
  else if (flashLabel) { status = `✓ ${flashLabel} tuned`; statusColor = '#10b981' }
  else if (!hasSignal) status = 'Listening…'
  else if (provisional) status = '···'
  else if (inTune) { status = '✓ In tune'; statusColor = '#10b981' }
  else if (isFlat) { status = '▲ Tune up'; statusColor = 'var(--flat-ink)' }
  else { status = '▼ Tune down'; statusColor = 'var(--sharp-ink)' }

  const centsColor = provisional ? 'var(--muted)' : SIG[sig].c

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between min-h-[88px]">
        <div className="flex items-start leading-none">
          <span className="text-[84px] font-medium tracking-[-0.04em] transition-colors duration-150" style={{ color: noteColor }}>
            {shown ? letter : '–'}
          </span>
          <span className="font-mono text-xl text-muted mt-2.5 ml-1">{shown ? octave : ''}</span>
        </div>

        {hasSignal && (
          <div className="egt-enter flex flex-col items-end gap-1.5 pb-2">
            <span className="whitespace-nowrap font-mono text-[26px] font-medium leading-none tabular-nums transition-colors" style={{ color: centsColor }}>
              {ci > 0 ? '+' : ci < 0 ? '−' : ''}{Math.abs(ci)}
              <span className="text-[13px] ml-0.5">¢</span>
            </span>
            {freq ? (
              <span className="whitespace-nowrap font-mono text-[11px] text-faint tabular-nums">{freq.toFixed(2)} Hz</span>
            ) : null}
            {/* The letter is the string being tuned; when what is sounding is
                another note (a string far off, or the wrong one), say so. */}
            {soundingNote ? (
              <span className="whitespace-nowrap font-mono text-[11px] text-ink-2 tabular-nums">playing {soundingNote}</span>
            ) : null}
          </div>
        )}

        {!listening && (
          <div className="flex flex-col items-end gap-2 pb-3 max-w-[170px]">
            <span className="flex items-center gap-1.5 h-[30px] px-3 rounded-full border border-line bg-surface text-[13px] font-medium text-ink whitespace-nowrap">
              <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              Tap the mic
            </span>
            <span className="text-xs leading-snug text-muted text-right">Pluck a string, or tap one below to lock it.</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5" aria-hidden="true">
        <div className="relative h-1.5">
          <span className="absolute top-px w-px h-[5px] bg-faint" style={{ left: `calc(${tickPct}% - 0.5px)` }} />
          <span className="absolute top-0 w-0.5 h-1.5 rounded-[1px] bg-ink-2" style={{ left: 'calc(50% - 1px)' }} />
          <span className="absolute top-px w-px h-[5px] bg-faint" style={{ left: `calc(${100 - tickPct}% - 0.5px)` }} />
        </div>
        <div className="grid gap-[3px] h-[22px]" style={{ gridTemplateColumns: `repeat(${SEGMENTS}, minmax(0, 1fr))` }}>
          {segs.map((g, i) => (
            <span key={i} className="rounded-[3px] h-full"
              style={{ background: g.c, boxShadow: g.glow, transition: `background ${fadeMs}ms, box-shadow ${fadeMs}ms` }} />
          ))}
        </div>
        <div className="relative flex justify-between items-center font-mono text-[11px] text-faint mt-0.5">
          <span style={{ color: isFlat ? '#38bdf8' : undefined }}>−{barRange}</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${tickPct}%` }}>−{tick}</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${100 - tickPct}%` }}>+{tick}</span>
          <span style={{ color: isSharp ? '#f59e0b' : undefined }}>+{barRange}</span>
        </div>
      </div>

      <div className="flex justify-center h-[18px] mt-0.5" aria-live="polite">
        <span className="whitespace-nowrap text-[13px] font-medium" style={{ color: statusColor }}>{status}</span>
      </div>
    </div>
  )
}
