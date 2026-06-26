import { isInTune } from '../utils/noteUtils'

function getLayout(count) {
  if (count === 4) {
    // Ukulele: 2 left, 2 right
    return {
      viewBox: '0 0 300 380',
      svgH: 380,
      headstock: { x: 115, y: 22, width: 70, height: 165, rx: 8 },
      leftIndices: [0, 1],
      rightIndices: [2, 3],
      pegXLeft: 119,
      pegXRight: 181,
      pegYs: [72, 140],
      stringXs: [130, 143, 157, 170],
      stringWidths: [1.8, 1.4, 1.1, 0.8],
      buttonR: 22,
      buttonXLeft: 58,
      buttonXRight: 242,
      labelFontSize: 13,
    }
  }

  if (count === 12) {
    // 12-string guitar: 6 left (even indices), 6 right (odd indices)
    return {
      viewBox: '0 0 300 460',
      svgH: 460,
      headstock: { x: 82, y: 18, width: 136, height: 268, rx: 10 },
      leftIndices: [0, 2, 4, 6, 8, 10],
      rightIndices: [1, 3, 5, 7, 9, 11],
      pegXLeft: 86,
      pegXRight: 214,
      pegYs: [48, 90, 132, 174, 216, 258],
      stringXs: [94, 100, 110, 116, 126, 132, 142, 148, 158, 164, 174, 180],
      stringWidths: [2.3, 1.8, 1.9, 1.4, 1.5, 1.1, 1.2, 0.9, 0.9, 0.8, 0.8, 0.7],
      buttonR: 17,
      buttonXLeft: 38,
      buttonXRight: 262,
      labelFontSize: 10,
    }
  }

  // 6-string guitar (default): 3 left, 3 right
  return {
    viewBox: '0 0 300 420',
    svgH: 420,
    headstock: { x: 92, y: 22, width: 116, height: 218, rx: 10 },
    leftIndices: [0, 1, 2],
    rightIndices: [3, 4, 5],
    pegXLeft: 96,
    pegXRight: 204,
    pegYs: [72, 132, 192],
    stringXs: [110, 125, 140, 160, 175, 190],
    stringWidths: [2.5, 2.0, 1.6, 1.3, 1.0, 0.7],
    buttonR: 22,
    buttonXLeft: 48,
    buttonXRight: 252,
    labelFontSize: 13,
  }
}

function getPegPos(stringIndex, layout) {
  const { leftIndices, rightIndices, pegXLeft, pegXRight, pegYs } = layout
  const li = leftIndices.indexOf(stringIndex)
  if (li !== -1) return { x: pegXLeft, y: pegYs[li] }
  const ri = rightIndices.indexOf(stringIndex)
  if (ri !== -1) return { x: pegXRight, y: pegYs[ri] }
  return null
}

function getButtonPos(stringIndex, layout) {
  const { leftIndices, rightIndices, pegYs, buttonXLeft, buttonXRight } = layout
  const li = leftIndices.indexOf(stringIndex)
  if (li !== -1) return { x: buttonXLeft, y: pegYs[li] }
  const ri = rightIndices.indexOf(stringIndex)
  if (ri !== -1) return { x: buttonXRight, y: pegYs[ri] }
  return null
}

function getStringColor(s, activeStringId, lockedStringId) {
  if (s.id === lockedStringId) return '#38bdf8'
  const isActive = lockedStringId !== null ? s.id === lockedStringId : s.id === activeStringId
  if (isActive) return '#dddddd'
  return '#666666'
}

function getButtonColors(s, activeStringId, lockedStringId, activeCents) {
  const isLocked = s.id === lockedStringId
  const isActive = lockedStringId !== null ? isLocked : s.id === activeStringId
  const inTune = isActive && isInTune(activeCents, 5)

  if (inTune) return { fill: '#052e16', stroke: '#22c55e', strokeWidth: 2 }
  if (isLocked) return { fill: '#082f49', stroke: '#0ea5e9', strokeWidth: 2 }
  if (isActive) return { fill: '#1c1917', stroke: '#d97706', strokeWidth: 2 }
  return { fill: '#27272a', stroke: '#52525b', strokeWidth: 1.5 }
}

export default function GuitarHeadstock({
  strings,
  activeStringId,
  lockedStringId,
  activeCents,
  onStringSelect,
  onPlay,
}) {
  const layout = getLayout(strings.length)
  const {
    viewBox, svgH, headstock, stringXs, stringWidths,
    pegXLeft, pegXRight, buttonR, labelFontSize,
  } = layout

  return (
    <div className="rounded-2xl bg-zinc-950 border border-zinc-800 p-2 flex justify-center">
      <svg
        viewBox={viewBox}
        className="w-full"
        style={{ maxWidth: '300px', maxHeight: '460px' }}
        aria-label="Guitar headstock string selector"
      >
        <defs>
          {/* Dot grid background */}
          <pattern id="hs-dotgrid" width="15" height="15" patternUnits="userSpaceOnUse">
            <circle cx="7.5" cy="7.5" r="0.8" fill="#222222" />
          </pattern>

          {/* Metallic headstock gradient */}
          <linearGradient id="hs-metal" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#181818" />
            <stop offset="25%"  stopColor="#2a2a2a" />
            <stop offset="50%"  stopColor="#383838" />
            <stop offset="75%"  stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#181818" />
          </linearGradient>

          {/* Top shine on headstock */}
          <linearGradient id="hs-shine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.07)" />
            <stop offset="40%"  stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>

          {/* Peg radial gradient */}
          <radialGradient id="hs-peg" cx="38%" cy="32%" r="65%">
            <stop offset="0%"   stopColor="#777777" />
            <stop offset="100%" stopColor="#303030" />
          </radialGradient>

          {/* Active string glow */}
          <filter id="hs-glow" x="-80%" y="-20%" width="260%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Button shadow */}
          <filter id="hs-btnshadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* SVG background */}
        <rect width="300" height={svgH} fill="#09090b" />
        <rect width="300" height={svgH} fill="url(#hs-dotgrid)" />

        {/* Headstock body */}
        <rect
          x={headstock.x}
          y={headstock.y}
          width={headstock.width}
          height={headstock.height}
          rx={headstock.rx}
          fill="url(#hs-metal)"
          stroke="#444444"
          strokeWidth="1.5"
        />
        {/* Shine overlay */}
        <rect
          x={headstock.x + 3}
          y={headstock.y + 2}
          width={headstock.width - 6}
          height={Math.min(60, headstock.height * 0.3)}
          rx={headstock.rx - 2}
          fill="url(#hs-shine)"
        />

        {/* Nut (bottom edge of headstock) */}
        <rect
          x={headstock.x - 2}
          y={headstock.y + headstock.height - 8}
          width={headstock.width + 4}
          height={8}
          rx={2}
          fill="#1a1a1a"
          stroke="#555555"
          strokeWidth="1"
        />

        {/* Strings — drawn before pegs so pegs sit on top */}
        {strings.map((s, i) => {
          const peg = getPegPos(i, layout)
          if (!peg) return null
          const isActive = lockedStringId !== null ? s.id === lockedStringId : s.id === activeStringId
          const isLocked = s.id === lockedStringId
          const color = getStringColor(s, activeStringId, lockedStringId)
          const sw = stringWidths[i] ?? 1.0
          const useGlow = isActive || isLocked

          return (
            <g key={`string-${s.id}`}>
              {/* Vertical segment: bottom of SVG to peg level */}
              <line
                x1={stringXs[i]} y1={svgH}
                x2={stringXs[i]} y2={peg.y}
                stroke={color}
                strokeWidth={sw}
                filter={useGlow ? 'url(#hs-glow)' : undefined}
              />
              {/* Horizontal segment: string x to peg x (inside headstock) */}
              <line
                x1={stringXs[i]} y1={peg.y}
                x2={peg.x}        y2={peg.y}
                stroke={color}
                strokeWidth={sw}
              />
            </g>
          )
        })}

        {/* Tuning pegs */}
        {strings.map((s, i) => {
          const peg = getPegPos(i, layout)
          if (!peg) return null
          // Only render one peg per unique position (avoid duplicates for paired strings)
          const isLeft = layout.leftIndices.includes(i)
          const x = isLeft ? pegXLeft : pegXRight
          return (
            <g key={`peg-${s.id}`}>
              <circle cx={x} cy={peg.y} r={10} fill="url(#hs-peg)" stroke="#606060" strokeWidth="1" />
              <circle cx={x} cy={peg.y} r={4.5} fill="#909090" stroke="#a0a0a0" strokeWidth="0.5" />
            </g>
          )
        })}

        {/* String note buttons */}
        {strings.map((s, i) => {
          const btn = getButtonPos(i, layout)
          if (!btn) return null
          const { fill, stroke, strokeWidth } = getButtonColors(s, activeStringId, lockedStringId, activeCents)
          const r = buttonR

          return (
            <g
              key={`btn-${s.id}`}
              onClick={() => onStringSelect(s.id)}
              style={{ cursor: 'pointer' }}
              filter="url(#hs-btnshadow)"
            >
              {/* Button circle */}
              <circle
                cx={btn.x}
                cy={btn.y}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {/* Note label */}
              <text
                x={btn.x}
                y={btn.y - 3}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={labelFontSize}
                fill="white"
                fontFamily="monospace"
                fontWeight="bold"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {s.label}
              </text>
              {/* Play icon — separate click target */}
              <text
                x={btn.x}
                y={btn.y + (r >= 20 ? 9 : 7)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8}
                fill="#888888"
                fontFamily="monospace"
                style={{ userSelect: 'none' }}
                onClick={(e) => { e.stopPropagation(); onPlay(s.freq) }}
              >
                ▶
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
