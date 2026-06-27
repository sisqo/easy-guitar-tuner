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
    buttonR: 24,
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
    buttonR: 25,
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
    buttonR: 20,
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

function isSameFreq(a, b) {
  return a != null && b != null && Math.abs(a - b) < 0.01
}

function stringColor(s, activeStringId, lockedStringId, dark, activeFreq) {
  if (s.id === lockedStringId) return '#38bdf8'
  if (lockedStringId === null && (s.id === activeStringId || isSameFreq(s.freq, activeFreq)))
    return dark ? '#ffffff' : '#1f2937'
  return dark ? '#c4c9d1' : '#7c7c86' // resting steel string
}

function buttonStyle(s, activeStringId, lockedStringId, activeCents, dark, inTuneThreshold, tunedStrings, activeFreq) {
  const isLocked = s.id === lockedStringId
  // In auto mode, also treat same-frequency companions as active (unison course pairs)
  const isActive = lockedStringId !== null ? isLocked : (s.id === activeStringId || isSameFreq(s.freq, activeFreq))
  const tuned = isActive && isInTune(activeCents, inTuneThreshold)
  const isMarked = tunedStrings?.has(s.id) && !isActive
  if (tuned)     return { fill: dark ? '#052e16' : '#ecfdf5', stroke: '#10b981', sw: 2.5, marker: false }
  if (isLocked)  return { fill: dark ? '#082f49' : '#f0f9ff', stroke: '#38bdf8', sw: 2.5, marker: false }
  if (isActive)  return { fill: dark ? '#1c1917' : '#fffbeb', stroke: '#fbbf24', sw: 2, marker: isMarked }
  if (isMarked)  return { fill: dark ? '#18181b' : '#ffffff', stroke: '#10b981', sw: 2.5, marker: true }
  return { fill: dark ? '#18181b' : '#ffffff', stroke: dark ? '#3f3f46' : '#d4d4d8', sw: 1.5, marker: false }
}

export default function GuitarHeadstock({
  strings, activeStringId, activeFreq, lockedStringId, activeCents, onStringSelect, onPlay, dark, inTuneThreshold = 5, tunedStrings,
}) {
  const L = getLayout(strings.length)
  const { viewBox, svgH, headstock: hs, nutH, nutXs, leftPegs, rightPegs,
          pegR, buttonR, leftBtnX, rightBtnX, labelSize, strWidths } = L
  const nutY = hs.y + hs.h

  const bgColor    = dark ? '#09090b' : '#f4f4f5'
  const dotColor   = dark ? '#27272a' : '#d4d4d8'
  const labelColor = dark ? '#ffffff' : '#3f3f46'

  return (
    <div className="rounded-2xl bg-zinc-100 border border-zinc-200 dark:bg-zinc-950 dark:border-zinc-800 p-2 flex justify-center overflow-hidden">
      <svg viewBox={viewBox} className="w-full" style={{ maxWidth: 300 }}
           aria-label="Guitar headstock tuner">
        <defs>
          <pattern id="dotgrid" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="7" cy="7" r="0.7" fill={dotColor} />
          </pattern>

          {/* Maple headstock — dark: softened honey; light: bleached natural maple */}
          <linearGradient id="wood-h" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={dark ? "#5e3f1c" : "#ddcfb4"} />
            <stop offset="14%"  stopColor={dark ? "#8a6128" : "#ece0cb"} />
            <stop offset="38%"  stopColor={dark ? "#c0954c" : "#f7f1e6"} />
            <stop offset="52%"  stopColor={dark ? "#caa055" : "#f9f4ea"} />
            <stop offset="70%"  stopColor={dark ? "#ad7c39" : "#f0e7d5"} />
            <stop offset="100%" stopColor={dark ? "#5e3f1c" : "#ddcfb4"} />
          </linearGradient>

          {/* Flamed-maple figure — faint horizontal bands across the grain */}
          <pattern id="woodfigure" width="120" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-1.2)">
            <rect width="120" height="5"   y="0"   fill={dark ? "rgba(55,33,8,0.18)"     : "rgba(150,120,70,0.10)"} />
            <rect width="120" height="1.4" y="6.4" fill={dark ? "rgba(255,224,160,0.07)" : "rgba(255,255,255,0.28)"} />
          </pattern>

          {/* Fine vertical grain */}
          <pattern id="woodgrain" width="6" height="120" patternUnits="userSpaceOnUse" patternTransform="rotate(1.2)">
            <line x1="0" y1="0" x2="0" y2="120" stroke={dark ? "rgba(0,0,0,0.07)" : "rgba(120,95,50,0.06)"} strokeWidth="0.8" />
            <line x1="3" y1="0" x2="3" y2="120" stroke={dark ? "rgba(255,220,150,0.06)" : "rgba(255,255,255,0.18)"} strokeWidth="0.5" />
          </pattern>

          {/* Gloss varnish — top sheen */}
          <linearGradient id="wood-shine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.34)" />
            <stop offset="10%"  stopColor="rgba(255,255,255,0.12)" />
            <stop offset="38%"  stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>

          {/* Inner edge shadow — gives the wood block rounded depth */}
          <linearGradient id="wood-edge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="rgba(0,0,0,0.30)" />
            <stop offset="7%"   stopColor="rgba(0,0,0,0)" />
            <stop offset="93%"  stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
          </linearGradient>

          {/* Bone / ivory nut */}
          <linearGradient id="nut-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="#efe6cf" />
            <stop offset="45%"  stopColor="#ddd0b0" />
            <stop offset="100%" stopColor="#b09972" />
          </linearGradient>

          {/* Nickel tuning machine */}
          <radialGradient id="peg-metal" cx="34%" cy="28%" r="74%">
            <stop offset="0%"   stopColor="#f5f6f8" />
            <stop offset="30%"  stopColor="#c6cad1" />
            <stop offset="66%"  stopColor="#80858f" />
            <stop offset="100%" stopColor="#3a3d43" />
          </radialGradient>
          <radialGradient id="peg-center" cx="38%" cy="32%" r="72%">
            <stop offset="0%"   stopColor="#eaecef" />
            <stop offset="100%" stopColor="#686c73" />
          </radialGradient>

          {/* Glossy sheen layered over each string button */}
          <linearGradient id="btn-sheen" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.16)" />
            <stop offset="45%"  stopColor="rgba(255,255,255,0.02)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
          </linearGradient>

          {/* Strings dissolve into the neck at the bottom */}
          <linearGradient id="string-fade" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stopColor={bgColor} stopOpacity="0" />
            <stop offset="100%" stopColor={bgColor} stopOpacity="1" />
          </linearGradient>

          <filter id="glow" x="-100%" y="-10%" width="300%" height="120%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>

          <filter id="btn-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity={dark ? 0.7 : 0.15} />
          </filter>

          <filter id="peg-shadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.3" floodColor="#000" floodOpacity="0.45" />
          </filter>
        </defs>

        {/* Background */}
        <rect width="300" height={svgH} fill={bgColor} />
        <rect width="300" height={svgH} fill="url(#dotgrid)" />

        {/* Headstock body — layered maple wood */}
        <rect x={hs.x} y={hs.y} width={hs.w} height={hs.h} rx={hs.rx}
              fill="url(#wood-h)" stroke={dark ? "#3f2a10" : "#cbbd9f"} strokeWidth="1.5" />
        <rect x={hs.x} y={hs.y} width={hs.w} height={hs.h} rx={hs.rx} fill="url(#woodfigure)" />
        <rect x={hs.x} y={hs.y} width={hs.w} height={hs.h} rx={hs.rx} fill="url(#woodgrain)" />
        <rect x={hs.x} y={hs.y} width={hs.w} height={hs.h} rx={hs.rx} fill="url(#wood-edge)" />
        <rect x={hs.x + 2} y={hs.y + 1} width={hs.w - 4}
              height={Math.min(60, hs.h * 0.32)} rx={hs.rx - 2}
              fill="url(#wood-shine)" />
        {/* Top bevel highlight */}
        <rect x={hs.x + 2} y={hs.y + 1.5} width={hs.w - 4} height="1.5" rx="0.75"
              fill="rgba(255,255,255,0.4)" />

        {/* Nut — bone/ivory with string slots */}
        <rect x={hs.x - 1} y={nutY} width={hs.w + 2} height={nutH}
              rx={2} fill="url(#nut-grad)" stroke="#9a8060" strokeWidth="1" />
        <rect x={hs.x - 1} y={nutY} width={hs.w + 2} height="1.4" rx="0.7" fill="rgba(255,255,255,0.45)" />
        {nutXs.map((nx, i) => (
          <line key={`slot-${i}`}
            x1={nx} y1={nutY + 1} x2={nx} y2={nutY + nutH - 1}
            stroke="#6a5030" strokeWidth={strWidths[i] ?? 1} />
        ))}

        {/* Strings — steel with cast shadow + specular highlight */}
        {strings.map((s, i) => {
          const res = getPeg(i, L)
          if (!res) return null
          const isActive = lockedStringId !== null
            ? s.id === lockedStringId
            : (s.id === activeStringId || isSameFreq(s.freq, activeFreq))
          const d = stringPath(nutXs[i], nutY, res.peg, svgH)
          const color = stringColor(s, activeStringId, lockedStringId, dark, activeFreq)
          const sw = strWidths[i] ?? 1
          return (
            <g key={`str-${s.id}`}>
              <path d={d} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={sw} transform="translate(1.1,0.6)" />
              <path d={d} fill="none" stroke={color} strokeWidth={sw}
                    filter={isActive ? 'url(#glow)' : undefined} />
              <path d={d} fill="none" strokeLinecap="round" transform="translate(-0.7,0)"
                    stroke={isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)'}
                    strokeWidth={Math.max(0.4, sw * 0.34)} />
            </g>
          )
        })}
        {/* Bottom fade — strings melt into the neck */}
        <rect x="0" y={svgH - 130} width="300" height="130" fill="url(#string-fade)" pointerEvents="none" />

        {/* Tuning machines — nickel with bezel + specular */}
        {[...leftPegs, ...rightPegs].map((p, i) => (
          <g key={`peg-${i}`} filter="url(#peg-shadow)">
            <circle cx={p.x} cy={p.y} r={pegR}
                    fill="url(#peg-metal)" stroke={dark ? "#2b2e33" : "#9aa0a8"} strokeWidth="1" />
            <circle cx={p.x} cy={p.y} r={pegR * 0.72} fill="none"
                    stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
            <circle cx={p.x} cy={p.y} r={pegR * 0.4}
                    fill="url(#peg-center)" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
            <circle cx={p.x - pegR * 0.28} cy={p.y - pegR * 0.32} r={pegR * 0.14}
                    fill="rgba(255,255,255,0.8)" />
          </g>
        ))}

        {/* Note buttons — a single tap toggles the lock and plays the reference tone */}
        {strings.map((s, i) => {
          const btn = getBtnPos(i, L)
          if (!btn) return null
          const { fill, stroke, sw: bsw, marker } = buttonStyle(s, activeStringId, lockedStringId, activeCents, dark, inTuneThreshold, tunedStrings, activeFreq)
          return (
            <g key={`btn-${s.id}`} style={{ cursor: 'pointer' }} filter="url(#btn-shadow)"
               onClick={() => { onPlay(s.freq); onStringSelect(s.id) }}>
              <circle cx={btn.x} cy={btn.y} r={buttonR}
                      fill={fill} stroke={stroke} strokeWidth={bsw} />
              <circle cx={btn.x} cy={btn.y} r={buttonR} fill="url(#btn-sheen)" style={{ pointerEvents: 'none' }} />
              <text x={btn.x} y={btn.y}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={labelSize} fill={labelColor}
                    fontFamily="'JetBrains Mono', monospace" fontWeight="700"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {s.label}
              </text>
              {marker && (
                <text
                  key={`marker-${s.id}`}
                  x={btn.x + buttonR * 0.52}
                  y={btn.y - buttonR * 0.52}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={buttonR >= 20 ? 8 : 6}
                  fill="#10b981"
                  fontFamily="monospace"
                  className="marker-appear"
                  style={{ userSelect: 'none', pointerEvents: 'none' }}
                >✓</text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
