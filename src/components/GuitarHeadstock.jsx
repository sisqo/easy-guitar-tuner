import { isInTune } from '../utils/noteUtils'

// Layout definitions per instrument type
const LAYOUTS = {
  4: {  // ukulele
    viewBox: '0 0 300 360',
    svgH: 360,
    headstock: { x: 110, y: 28, w: 80, h: 160, rx: 8 },
    nutH: 9,
    nutXs: [122, 140, 160, 178],
    leftPegs:  [{ x: 116, y: 68 }, { x: 116, y: 135 }],
    rightPegs: [{ x: 184, y: 68 }, { x: 184, y: 135 }],
    leftIndices:  [1, 0],
    rightIndices: [2, 3],
    pegR: 9,
    buttonR: 21,
    leftBtnX: 52,
    rightBtnX: 248,
    labelSize: 13,
    strWidths: [1.6, 1.2, 1.0, 0.7],
  },
  6: {  // guitar 6-string
    viewBox: '0 0 300 420',
    svgH: 420,
    headstock: { x: 93, y: 28, w: 114, h: 215, rx: 10 },
    nutH: 10,
    nutXs: [107, 123, 139, 161, 177, 193],
    leftPegs:  [{ x: 100, y: 72 }, { x: 100, y: 135 }, { x: 100, y: 198 }],
    rightPegs: [{ x: 200, y: 72 }, { x: 200, y: 135 }, { x: 200, y: 198 }],
    leftIndices:  [2, 1, 0],
    rightIndices: [3, 4, 5],
    pegR: 10,
    buttonR: 22,
    leftBtnX: 44,
    rightBtnX: 256,
    labelSize: 13,
    strWidths: [2.4, 1.9, 1.5, 1.2, 0.9, 0.7],
  },
  12: {  // guitar 12-string
    viewBox: '0 0 300 480',
    svgH: 480,
    headstock: { x: 80, y: 22, w: 140, h: 308, rx: 10 },
    nutH: 10,
    nutXs: [92, 100, 110, 118, 128, 136, 164, 172, 182, 190, 200, 208],
    leftPegs:  [
      { x: 87, y: 55 }, { x: 87, y: 107 }, { x: 87, y: 159 },
      { x: 87, y: 211 }, { x: 87, y: 263 }, { x: 87, y: 315 },
    ],
    rightPegs: [
      { x: 213, y: 55 }, { x: 213, y: 107 }, { x: 213, y: 159 },
      { x: 213, y: 211 }, { x: 213, y: 263 }, { x: 213, y: 315 },
    ],
    leftIndices:  [4, 5, 2, 3, 0, 1],
    rightIndices: [6, 7, 8, 9, 10, 11],
    pegR: 9,
    buttonR: 17,
    leftBtnX: 36,
    rightBtnX: 264,
    labelSize: 10,
    strWidths: [2.2, 1.7, 1.8, 1.4, 1.5, 1.1, 1.1, 0.9, 0.9, 0.8, 0.8, 0.7],
  },
}

function getLayout(count) {
  return LAYOUTS[count] ?? LAYOUTS[6]
}

function getPeg(stringIndex, layout) {
  const li = layout.leftIndices.indexOf(stringIndex)
  if (li !== -1) return { peg: layout.leftPegs[li], side: 'left', sideIdx: li }
  const ri = layout.rightIndices.indexOf(stringIndex)
  if (ri !== -1) return { peg: layout.rightPegs[ri], side: 'right', sideIdx: ri }
  return null
}

function getBtnPos(stringIndex, layout) {
  const li = layout.leftIndices.indexOf(stringIndex)
  if (li !== -1) return { x: layout.leftBtnX, y: layout.leftPegs[li].y }
  const ri = layout.rightIndices.indexOf(stringIndex)
  if (ri !== -1) return { x: layout.rightBtnX, y: layout.rightPegs[ri].y }
  return null
}

function stringPath(strX, nutY, peg, svgH) {
  const { x: pegX, y: pegY } = peg
  const midY = (nutY + pegY) / 2
  return [
    `M ${strX} ${svgH}`,
    `L ${strX} ${nutY}`,
    `C ${strX} ${midY} ${pegX} ${midY} ${pegX} ${pegY}`,
  ].join(' ')
}

function stringColor(s, activeStringId, lockedStringId, dark) {
  if (s.id === lockedStringId) return '#38bdf8'
  if (lockedStringId === null && s.id === activeStringId) return dark ? '#e4e4e7' : '#3f3f46'
  return dark ? '#52525b' : '#a1a1aa'
}

function buttonStyle(s, activeStringId, lockedStringId, activeCents, dark) {
  const isLocked = s.id === lockedStringId
  const isActive = lockedStringId !== null ? isLocked : s.id === activeStringId
  const tuned = isActive && isInTune(activeCents, 5)
  if (tuned)    return { fill: dark ? '#052e16' : '#ecfdf5', stroke: '#22c55e', sw: 2.5 }
  if (isLocked) return { fill: dark ? '#082f49' : '#f0f9ff', stroke: '#0ea5e9', sw: 2.5 }
  if (isActive) return { fill: dark ? '#1c1917' : '#fffbeb', stroke: '#d97706', sw: 2 }
  return { fill: dark ? '#18181b' : '#ffffff', stroke: dark ? '#3f3f46' : '#d4d4d8', sw: 1.5 }
}

export default function GuitarHeadstock({
  strings, activeStringId, lockedStringId, activeCents, onStringSelect, onPlay, dark,
}) {
  const L = getLayout(strings.length)
  const { viewBox, svgH, headstock: hs, nutH, nutXs, leftPegs, rightPegs,
          pegR, buttonR, leftBtnX, rightBtnX, labelSize, strWidths } = L
  const nutY = hs.y + hs.h

  const bgColor    = dark ? '#09090b' : '#f4f4f5'
  const dotColor   = dark ? '#27272a' : '#d4d4d8'
  const labelColor = dark ? '#ffffff' : '#3f3f46'
  const playColor  = dark ? '#71717a' : '#a1a1aa'

  return (
    <div className="rounded-2xl bg-zinc-100 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 p-2 flex justify-center overflow-hidden">
      <svg viewBox={viewBox} className="w-full" style={{ maxWidth: 300 }}
           aria-label="Guitar headstock tuner">
        <defs>
          <pattern id="dotgrid" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="0.7" fill={dotColor} />
          </pattern>

          <linearGradient id="metal-h" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#0f0f0f" />
            <stop offset="30%"  stopColor="#242424" />
            <stop offset="50%"  stopColor="#323232" />
            <stop offset="70%"  stopColor="#242424" />
            <stop offset="100%" stopColor="#0f0f0f" />
          </linearGradient>

          <linearGradient id="metal-shine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.09)" />
            <stop offset="35%"  stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>

          <linearGradient id="nut-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#555" />
            <stop offset="100%" stopColor="#222" />
          </linearGradient>

          <radialGradient id="peg-grad" cx="35%" cy="30%" r="65%">
            <stop offset="0%"   stopColor="#888" />
            <stop offset="100%" stopColor="#2a2a2a" />
          </radialGradient>

          <filter id="glow" x="-100%" y="-10%" width="300%" height="120%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          <filter id="btn-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity={dark ? 0.7 : 0.15} />
          </filter>
        </defs>

        {/* Background */}
        <rect width="300" height={svgH} fill={bgColor} />
        <rect width="300" height={svgH} fill="url(#dotgrid)" />

        {/* Headstock body */}
        <rect x={hs.x} y={hs.y} width={hs.w} height={hs.h} rx={hs.rx}
              fill="url(#metal-h)" stroke="#3a3a3a" strokeWidth="1.5" />
        <rect x={hs.x + 3} y={hs.y + 2} width={hs.w - 6}
              height={Math.min(55, hs.h * 0.28)} rx={hs.rx - 2}
              fill="url(#metal-shine)" />

        {/* Nut */}
        <rect x={hs.x - 1} y={nutY} width={hs.w + 2} height={nutH}
              rx={2} fill="url(#nut-grad)" stroke="#555" strokeWidth="1" />
        {nutXs.map((nx, i) => (
          <line key={`slot-${i}`}
            x1={nx} y1={nutY + 1} x2={nx} y2={nutY + nutH - 1}
            stroke="#000" strokeWidth={strWidths[i] ?? 1} />
        ))}

        {/* Strings */}
        {strings.map((s, i) => {
          const res = getPeg(i, L)
          if (!res) return null
          const isActive = lockedStringId !== null ? s.id === lockedStringId : s.id === activeStringId
          const d = stringPath(nutXs[i], nutY, res.peg, svgH)
          const color = stringColor(s, activeStringId, lockedStringId, dark)
          const sw = strWidths[i] ?? 1
          return (
            <path key={`str-${s.id}`}
              d={d} fill="none" stroke={color} strokeWidth={sw}
              filter={isActive ? 'url(#glow)' : undefined}
            />
          )
        })}

        {/* Tuning pegs */}
        {[...leftPegs.map(p => ({ ...p, side: 'left' })),
          ...rightPegs.map(p => ({ ...p, side: 'right' }))].map((p, i) => (
          <g key={`peg-${i}`}>
            <circle cx={p.x} cy={p.y} r={pegR}
                    fill="url(#peg-grad)" stroke="#555" strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r={pegR * 0.42}
                    fill="#999" stroke="#aaa" strokeWidth="0.5" />
          </g>
        ))}

        {/* Note buttons */}
        {strings.map((s, i) => {
          const btn = getBtnPos(i, L)
          if (!btn) return null
          const { fill, stroke, sw: bsw } = buttonStyle(s, activeStringId, lockedStringId, activeCents, dark)
          return (
            <g key={`btn-${s.id}`} style={{ cursor: 'pointer' }} filter="url(#btn-shadow)"
               onClick={() => onStringSelect(s.id)}>
              <circle cx={btn.x} cy={btn.y} r={buttonR}
                      fill={fill} stroke={stroke} strokeWidth={bsw} />
              <text x={btn.x} y={btn.y - (buttonR >= 20 ? 4 : 3)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={labelSize} fill={labelColor}
                    fontFamily="'JetBrains Mono', monospace" fontWeight="700"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {s.label}
              </text>
              <text x={btn.x} y={btn.y + (buttonR >= 20 ? 10 : 7)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={8} fill={playColor} fontFamily="monospace"
                    style={{ userSelect: 'none' }}
                    onClick={e => { e.stopPropagation(); onPlay(s.freq) }}>
                ▶
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
