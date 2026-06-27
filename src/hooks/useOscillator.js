import { useRef, useCallback } from 'react'

// A plucked-string-ish harmonic spectrum (warm 1/n rolloff), built once per context
function makePluckWave(ctx) {
  const N = 18
  const real = new Float32Array(N)
  const imag = new Float32Array(N)
  for (let n = 1; n < N; n++) {
    imag[n] = (1 / n) * Math.exp(-n / 9)
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false })
}

export function useOscillator() {
  const ctxRef = useRef(null)
  const waveRef = useRef(null)
  const oscRef = useRef(null)

  const playNote = useCallback((frequency, duration = 1.6) => {
    const firstTime = !ctxRef.current
    const ctx = ctxRef.current || new (window.AudioContext || window.webkitAudioContext)()
    ctxRef.current = ctx
    // Route to the loudspeaker (speakerphone), not the iOS earpiece, when the mic is live
    if (firstTime && 'audioSession' in navigator) {
      try { navigator.audioSession.type = 'play-and-record' } catch { /* unsupported */ }
    }
    // Mobile browsers start the context suspended until a user gesture resumes it
    if (ctx.state === 'suspended') ctx.resume()
    if (!waveRef.current) waveRef.current = makePluckWave(ctx)

    // Stop any note still sounding so the new one always starts cleanly
    if (oscRef.current) {
      try { oscRef.current.stop() } catch { /* already stopped */ }
      oscRef.current = null
    }

    const now = ctx.currentTime
    const nyquist = ctx.sampleRate / 2

    // Amplitude: quick pluck attack, then exponential string decay
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    // Brightness decays faster than the fundamental, like a damped string
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.6
    filter.frequency.setValueAtTime(Math.min(nyquist - 1000, Math.max(frequency * 10, 3000)), now)
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 3, 700), now + duration)

    const osc = ctx.createOscillator()
    osc.setPeriodicWave(waveRef.current)
    osc.frequency.value = frequency
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration)
    osc.onended = () => { try { gain.disconnect(); filter.disconnect() } catch { /* noop */ } }
    oscRef.current = osc
  }, [])

  return { playNote }
}
