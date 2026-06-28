const FRETS = 4

// Vertical chord chart: nut at top, strings as columns, frets as rows.
// Reads a chords-db position { frets, fingers, barres, baseFret }.
export default function ChordDiagram({ position, strings = 6, accentSet, dark = true }) {
  const sGap = 22
  const fGap = 26
  const padX = 20
  const padTop = 28
  const padBottom = 12

  const baseFret = position.baseFret ?? 1
  const showNut = baseFret === 1
  const barres = position.barres ?? []

  const boardW = (strings - 1) * sGap
  const boardH = FRETS * fGap
  const x0 = padX
  const y0 = padTop
  const W = boardW + padX * 2
  const H = boardH + padTop + padBottom
  const sx = (i) => x0 + i * sGap
  const fy = (r) => y0 + r * fGap
  const dotY = (f) => fy(f) - fGap / 2
  const markY = y0 - 11

  const line     = dark ? '#52525b' : '#bcbcc4'
  const nutColor = dark ? '#d4d4d8' : '#3f3f46'
  const markCol  = dark ? '#a1a1aa' : '#71717a'
  const dotFill  = dark ? '#e7e7ea' : '#27272a'
  const dotText  = dark ? '#18181b' : '#ffffff'
  const rootFill = '#2aab9e'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: strings > 4 ? 200 : 150 }}
      role="img" aria-label="Chord diagram">
      {/* Position label for higher (non-open) voicings */}
      {!showNut && (
        <text x={x0 - 8} y={dotY(1) + 4} textAnchor="end" fontSize="11" fill={markCol}
          fontFamily="'JetBrains Mono', monospace">{baseFret}fr</text>
      )}

      {/* Fret rows */}
      {Array.from({ length: FRETS + 1 }).map((_, r) => (
        <line key={`f${r}`} x1={x0} y1={fy(r)} x2={x0 + boardW} y2={fy(r)} stroke={line} strokeWidth="1" />
      ))}
      {/* String columns */}
      {Array.from({ length: strings }).map((_, i) => (
        <line key={`s${i}`} x1={sx(i)} y1={y0} x2={sx(i)} y2={y0 + boardH} stroke={line} strokeWidth="1" />
      ))}
      {/* Nut (only when the open position is shown) */}
      {showNut && <rect x={x0 - 1} y={y0 - 3.5} width={boardW + 2} height="4" rx="1" fill={nutColor} />}

      {/* Barres */}
      {barres.map((bf, k) => {
        const idxs = position.frets.map((f, i) => (f === bf ? i : -1)).filter((i) => i >= 0)
        if (!idxs.length) return null
        const a = Math.min(...idxs)
        const b = Math.max(...idxs)
        const fg = position.fingers?.[a] ?? 0
        return (
          <g key={`b${k}`}>
            <rect x={sx(a) - 8} y={dotY(bf) - 8} width={(b - a) * sGap + 16} height="16" rx="8" fill={dotFill} />
            {fg > 0 && (
              <text x={sx(a)} y={dotY(bf) + 0.5} textAnchor="middle" dominantBaseline="middle"
                fontSize="10" fontWeight="700" fill={dotText} fontFamily="'JetBrains Mono', monospace">{fg}</text>
            )}
          </g>
        )
      })}

      {/* Open / muted markers and fretted finger dots */}
      {position.frets.map((f, i) => {
        if (f === -1) {
          return <text key={`m${i}`} x={sx(i)} y={markY} textAnchor="middle" fontSize="11" fill={markCol}
            fontFamily="'JetBrains Mono', monospace">✕</text>
        }
        if (f === 0) {
          return <text key={`m${i}`} x={sx(i)} y={markY} textAnchor="middle" fontSize="12" fill={markCol}
            fontFamily="'JetBrains Mono', monospace">○</text>
        }
        if (barres.includes(f)) return null // covered by the barre bar
        const isRoot = accentSet?.has(i)
        const finger = position.fingers?.[i] ?? 0
        return (
          <g key={`d${i}`}>
            <circle cx={sx(i)} cy={dotY(f)} r="8.5" fill={isRoot ? rootFill : dotFill} />
            {finger > 0 && (
              <text x={sx(i)} y={dotY(f) + 0.5} textAnchor="middle" dominantBaseline="middle"
                fontSize="10" fontWeight="700" fill={isRoot ? '#ffffff' : dotText}
                fontFamily="'JetBrains Mono', monospace">{finger}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
