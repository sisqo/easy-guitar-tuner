import { useRef, useCallback } from 'react'

export function useSuccessBeep() {
  const ctxRef = useRef(null)

  const beep = useCallback(() => {
    const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx
    // The beep fires from a detection effect, not a user gesture — mobile browsers
    // may keep the context suspended. With the mic session live, resume() succeeds.
    if (ctx.state === 'suspended') ctx.resume()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
    gain.connect(ctx.destination)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 880
    osc.connect(gain)
    osc.start()
    osc.stop(ctx.currentTime + 0.15)
  }, [])

  return { beep }
}
