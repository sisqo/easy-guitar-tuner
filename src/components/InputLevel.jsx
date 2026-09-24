import { useEffect, useRef, useState } from 'react'

// Input level, so an empty readout can be told apart: nothing reaching the mic,
// or sound that is not a clear note. Without it both read "listening…" and the
// user cannot tell whether to play louder, come closer, or mute the other strings.
//
// Like DebugOverlay it reads the detector's stats ref on its own clock, so the
// meter re-renders itself and nothing else.
const POLL_MS = 50

// RMS after the filters, in dBFS, mapped onto the meter. -66 sits under the
// absolute noise gate (0.001 = -60 dB); -14 is a hard pluck close to the mic.
const DB_MIN = -66
const DB_MAX = -14

// "Sound but no note" has to persist this long before it is worth saying: a
// pluck's first frames and its last ones fail clarity for a moment as a matter
// of course.
const HINT_AFTER_MS = 600

function toPct(rms) {
  if (!(rms > 0)) return 0
  const db = 20 * Math.log10(rms)
  return Math.max(0, Math.min(100, ((db - DB_MIN) / (DB_MAX - DB_MIN)) * 100))
}

export default function InputLevel({ statsRef, hasNote }) {
  const [s, setS] = useState({ rms: 0, gateLevel: 0, unclear: false })
  const unclearSince = useRef(null)

  useEffect(() => {
    const id = setInterval(() => {
      const { rms, gateLevel, gate } = statsRef.current
      const now = performance.now()
      if (gate === 'clarity') unclearSince.current ??= now
      else unclearSince.current = null
      const unclear = unclearSince.current !== null && now - unclearSince.current >= HINT_AFTER_MS
      setS({ rms, gateLevel, unclear })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [statsRef])

  const level = toPct(s.rms)
  const gate = toPct(s.gateLevel)
  const heard = s.rms >= s.gateLevel && s.rms > 0

  return (
    <div className="mt-2 flex flex-col items-center gap-1" aria-hidden="true">
      <div className="relative h-1 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-75 ${heard ? 'bg-teal-500/80' : 'bg-zinc-400/60 dark:bg-zinc-600'}`}
          style={{ width: `${level}%` }}
        />
        {/* Where the noise gate currently sits: below it, a pluck is not heard */}
        <div className="absolute inset-y-0 w-px bg-zinc-500/70 dark:bg-zinc-400/60" style={{ left: `${gate}%` }} />
      </div>
      {/* Fixed height, so the hint appearing does not shift the headstock */}
      <span className="h-3 text-[10px] leading-3 text-zinc-400 dark:text-zinc-600">
        {!hasNote && s.unclear ? 'sound, but no clear note' : ''}
      </span>
    </div>
  )
}
