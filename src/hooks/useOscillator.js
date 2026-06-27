import { useRef, useCallback } from 'react'

export function useOscillator() {
  const ctxRef = useRef(null)
  const oscRef = useRef(null)

  const playNote = useCallback((frequency, duration = 1.5) => {
    const firstTime = !ctxRef.current
    const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx
    // Route to the loudspeaker (speakerphone), not the iOS earpiece, when the mic is live
    if (firstTime && 'audioSession' in navigator) {
      try { navigator.audioSession.type = 'play-and-record' } catch { /* unsupported */ }
    }
    // Mobile browsers start the context suspended until a user gesture resumes it
    if (ctx.state === 'suspended') ctx.resume()

    // Stop any note still sounding so the new one always starts cleanly
    if (oscRef.current) {
      try { oscRef.current.stop() } catch { /* already stopped */ }
      oscRef.current = null
    }

    const now = ctx.currentTime
    const gainNode = ctx.createGain()
    // Fast exponential attack (avoids a click) up to a loud peak, then decay
    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.85, now + 0.012)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration)
    gainNode.connect(ctx.destination)

    const osc = ctx.createOscillator()
    osc.type = 'triangle' // fuller / louder perceived tone than a pure sine
    osc.frequency.value = frequency
    osc.connect(gainNode)
    osc.start(now)
    osc.stop(now + duration)
    osc.onended = () => { try { gainNode.disconnect() } catch { /* noop */ } }
    oscRef.current = osc
  }, [])

  return { playNote }
}
