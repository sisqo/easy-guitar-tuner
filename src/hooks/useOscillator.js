import { useRef, useCallback } from 'react'

export function useOscillator() {
  const ctxRef = useRef(null)
  const oscRef = useRef(null)

  const playNote = useCallback((frequency, duration = 1.5) => {
    if (oscRef.current) {
      oscRef.current.stop()
      oscRef.current = null
    }

    const ctx = ctxRef.current || new AudioContext()
    ctxRef.current = ctx

    const gainNode = ctx.createGain()
    gainNode.gain.setValueAtTime(0.4, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    gainNode.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = frequency
    osc.connect(gainNode)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    oscRef.current = osc
  }, [])

  return { playNote }
}
