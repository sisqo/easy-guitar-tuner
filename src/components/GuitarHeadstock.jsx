import { memo } from 'react'

// Geometry per string count. The view is cropped CROP units below the nut: the
// strings fade into the panel instead of running to the bottom of a tall SVG.
//   hs            headstock rect [x, y, w, h, rx]
//   leftIndices / rightIndices   string indices per side, top-to-bottom
//   leftPegs / rightPegs         peg centres, same order
//   leftBtnX / rightBtnX         button column x; buttons sit level with their peg
const CROP = 97
const RAW = {
  4: {  // ukulele
    hs: [110, 28, 80, 160, 12],
    nutXs: [122, 140, 160, 178],
    leftPegs: [[116, 68], [116, 135]], rightPegs: [[184, 68], [184, 135]],
    leftIndices: [1, 0], rightIndices: [2, 3],
    pegR: 9, buttonR: 24, leftBtnX: 52, rightBtnX: 248, labelSize: 14,
    strWidths: [1.6, 1.2, 1.0, 0.7],
  },
  6: {  // guitar 6-string
    hs: [93, 28, 114, 215, 16],
    nutXs: [107, 123, 139, 161, 177, 193],
    leftPegs: [[100, 72], [100, 135], [100, 198]], rightPegs: [[200, 72], [200, 135], [200, 198]],
    leftIndices: [2, 1, 0], rightIndices: [3, 4, 5],
    pegR: 10, buttonR: 23, leftBtnX: 44, rightBtnX: 256, labelSize: 14,
    strWidths: [2.4, 1.9, 1.5, 1.2, 0.9, 0.7],
  },
  12: {  // guitar 12-string
    hs: [80, 22, 140, 308, 16],
    // Courses sit in tight pairs. On the bass side each pair's octave string is
    // nearer the edge, so the lower-pitched string (top peg) is the inner one and
    // the two never cross on their way to the pegs.
    nutXs: [96.5, 92, 116, 111.5, 136, 131.5, 164, 168.5, 184, 188.5, 203.5, 208],
    leftPegs: [[87, 55], [87, 107], [87, 159], [87, 211], [87, 263], [87, 315]],
    rightPegs: [[213, 55], [213, 107], [213, 159], [213, 211], [213, 263], [213, 315]],
    leftIndices: [4, 5, 2, 3, 0, 1], rightIndices: [6, 7, 8, 9, 10, 11],
    pegR: 9, buttonR: 20, leftBtnX: 36, rightBtnX: 264, labelSize: 11,
    strWidths: [2.2, 1.7, 1.8, 1.4, 1.5, 1.1, 1.1, 0.9, 0.9, 0.8, 0.8, 0.7],
  },
}

function build(R) {
  const [x, y, w, h, rx] = R.hs
  const nutY = y + h
  const H = nutY + CROP
  const peg = []
  const btn = []
  R.leftIndices.forEach((s, k) => { peg[s] = R.leftPegs[k]; btn[s] = [R.leftBtnX, R.leftPegs[k][1]] })
  R.rightIndices.forEach((s, k) => { peg[s] = R.rightPegs[k]; btn[s] = [R.rightBtnX, R.rightPegs[k][1]] })
  const path = (i) => {
    const sx = R.nutXs[i]
    const [px, py] = peg[i]
    const m = (nutY + py) / 2
    return `M ${sx} ${H} L ${sx} ${nutY} C ${sx} ${m} ${px} ${m} ${px} ${py}`
  }
  return { ...R, hs: { x, y, w, h, rx }, nutY, H, peg, btn, path }
}

const LAYOUTS = { 4: build(RAW[4]), 6: build(RAW[6]), 12: build(RAW[12]) }

const SIG = { emerald: '#10b981', amber: '#fbbf24', sky: '#38bdf8', zinc: '#a1a1aa' }
const LOCK = '#38bdf8'

function isSameFreq(a, b) {
  return a != null && b != null && Math.abs(a - b) < 0.01
}

function GuitarHeadstock({
  strings, activeStringId, activeFreq, lockedStringId, inTune = false, signal = null, listening = false,
  onStringSelect, onPlay, tunedStrings, flash = null,
}) {
  const L = LAYOUTS[strings.length] ?? LAYOUTS[6]
  const { hs, nutY, H } = L

  // In auto mode, same-frequency companions (unison course pairs) are active too.
  const isActive = (s) => lockedStringId !== null
    ? s.id === lockedStringId
    : (s.id === activeStringId || isSameFreq(s.freq, activeFreq))
  // `signal` is App's colour for the reading (null when nothing is measured);
  // `inTune` is the latched verdict shared with the bar and the beep.
  const sigKey = inTune ? 'emerald' : signal
  const activeColor = sigKey ? SIG[sigKey] : LOCK

  const flashIdx = flash ? strings.findIndex(s => s.id === flash.stringId) : -1

  return (
    <div className="relative w-full max-w-[340px] mx-auto">
      <svg viewBox={`0 0 300 ${H}`} className="block w-full" aria-label="Guitar headstock tuner">
        <defs>
          <linearGradient id="hs-wood" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--wood-0)' }} />
            <stop offset="0.5" style={{ stopColor: 'var(--wood-1)' }} />
            <stop offset="1" style={{ stopColor: 'var(--wood-0)' }} />
          </linearGradient>
          <linearGradient id="hs-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="0.3" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id="hs-peg" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#e4e4e7" />
            <stop offset="0.6" stopColor="#8b8b93" />
            <stop offset="1" stopColor="#3a3a40" />
          </radialGradient>
          {/* Strings dissolve into the panel at the bottom */}
          <linearGradient id="hs-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--bg)', stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: 'var(--bg)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        <rect x={hs.x} y={hs.y} width={hs.w} height={hs.h} rx={hs.rx} fill="url(#hs-wood)" />
        <rect x={hs.x} y={hs.y} width={hs.w} height={hs.h} rx={hs.rx} fill="url(#hs-sheen)" />
        <rect x={hs.x + 1} y={hs.y + 2} width={hs.w - 2} height={hs.h - 4} rx={hs.rx - 1}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <rect x={hs.x - 1} y={nutY} width={hs.w + 2} height="7" rx="2" fill="#d9cfb8" />

        {strings.map((s, i) => {
          const act = isActive(s)
          // The string being tuned trembles until it is in tune
          const vib = act && listening && signal !== null && !inTune
          return (
            <path key={`str-${s.id}`} d={L.path(i)} fill="none"
              className={vib ? 'egt-vib' : undefined}
              strokeWidth={L.strWidths[i]} opacity={act ? 1 : 0.7}
              style={{
                stroke: act ? activeColor : 'var(--str-rest)',
                transition: 'stroke 120ms',
                transformBox: 'fill-box',
                animation: vib ? `egt-vib ${70 + i * 6}ms linear infinite` : 'none',
              }} />
          )
        })}
        <rect x="0" y={H - 90} width="300" height="90" fill="url(#hs-fade)" pointerEvents="none" />

        {L.peg.map(([x, y], i) => (
          <circle key={`peg-${i}`} cx={x} cy={y} r={L.pegR * 0.8} fill="url(#hs-peg)" />
        ))}

        {/* Note buttons — a single tap toggles the lock and plays the reference tone */}
        {strings.map((s, i) => {
          const [x, y] = L.btn[i]
          const act = isActive(s)
          const locked = s.id === lockedStringId
          const marked = tunedStrings?.has(s.id) && !act
          let fill = 'var(--btn-fill)'
          let stroke = marked ? 'rgba(16,185,129,0.6)' : 'var(--btn-stroke)'
          let sw = 1
          if (act && inTune) { fill = 'rgba(16,185,129,0.16)'; stroke = SIG.emerald; sw = 1.5 }
          else if (locked) { fill = 'rgba(56,189,248,0.14)'; stroke = LOCK; sw = 1.5 }
          else if (act) { fill = sigKey === 'amber' ? 'rgba(251,191,36,0.14)' : 'rgba(56,189,248,0.14)'; stroke = activeColor; sw = 1.5 }
          return (
            <g key={`btn-${s.id}`} className="cursor-pointer" role="button" aria-label={`${s.label}${locked ? ', locked' : ''}`}
               onClick={() => { onPlay(s.freq); onStringSelect(s.id) }}>
              <circle cx={x} cy={y} r={L.buttonR} strokeWidth={sw}
                style={{ fill, stroke, transition: 'fill 120ms, stroke 120ms' }} />
              {marked && (
                <circle cx={x} cy={y + L.buttonR * 0.48} r="2" fill="#10b981"
                  className="marker-appear" style={{ pointerEvents: 'none' }} />
              )}
            </g>
          )
        })}
      </svg>

      {/* Labels in HTML, so they render in the UI font at a crisp size */}
      {strings.map((s, i) => {
        const [x, y] = L.btn[i]
        const act = isActive(s)
        const marked = tunedStrings?.has(s.id) && !act
        const color = act && inTune ? 'var(--btn-tuned-fg)'
          : s.id === lockedStringId ? 'var(--btn-locked-fg)'
          : 'var(--btn-fg)'
        return (
          <span key={`lbl-${s.id}`} aria-hidden="true"
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none font-medium tabular-nums whitespace-nowrap"
            style={{ left: `${(x / 300) * 100}%`, top: `${((marked ? y - 2 : y) / H) * 100}%`, fontSize: L.labelSize, color }}>
            {s.label}
          </span>
        )
      })}

      {/* One ring off the button of a string the moment it is marked tuned */}
      {flashIdx >= 0 && (
        <span key={flash.key} className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none aspect-square"
          style={{
            left: `${(L.btn[flashIdx][0] / 300) * 100}%`,
            top: `${(L.btn[flashIdx][1] / H) * 100}%`,
            width: `${((L.buttonR * 2) / 300) * 100}%`,
          }}>
          <span className="egt-pulse absolute inset-0 rounded-full border-2 border-emerald-500" />
        </span>
      )}
    </div>
  )
}

// The headstock is the heaviest node in the tree — an SVG with gradients and
// one Bézier per string. It depends on which string is active, the colour of the
// reading and the in-tune verdict, not on the pitch itself, so it has no
// business re-rendering every time a new reading arrives.
export default memo(GuitarHeadstock)
