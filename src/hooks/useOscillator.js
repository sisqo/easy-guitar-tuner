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
  const chordBusRef = useRef(null)

  const ensureCtx = useCallback(() => {
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
    return ctx
  }, [])

  // Build one plucked-string voice into `destination`, scheduled at `start`.
  const voice = useCallback((ctx, frequency, start, duration, peak, destination) => {
    const nyquist = ctx.sampleRate / 2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.6
    filter.frequency.setValueAtTime(Math.min(nyquist - 1000, Math.max(frequency * 10, 3000)), start)
    filter.frequency.exponentialRampToValueAtTime(Math.max(frequency * 3, 700), start + duration)

    const osc = ctx.createOscillator()
    osc.setPeriodicWave(waveRef.current)
    osc.frequency.value = frequency
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(destination)
    osc.start(start)
    osc.stop(start + duration)
    osc.onended = () => { try { gain.disconnect(); filter.disconnect() } catch { /* noop */ } }
    return osc
  }, [])

  const playNote = useCallback((frequency, duration = 1.6) => {
    const ctx = ensureCtx()
    // Stop any note still sounding so the new one always starts cleanly
    if (oscRef.current) { try { oscRef.current.stop() } catch { /* already stopped */ } oscRef.current = null }
    oscRef.current = voice(ctx, frequency, ctx.currentTime, duration, 0.9, ctx.destination)
  }, [ensureCtx, voice])

  // Strum a chord: MIDI notes triggered low -> high with a small stagger.
  const playChord = useCallback((midis, diapason = 440, { duration = 2.6, strum = 0.028 } = {}) => {
    if (!midis || !midis.length) return
    const ctx = ensureCtx()
    // Shared compressor keeps the summed voices from clipping
    if (!chordBusRef.current) {
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 3
      comp.attack.value = 0.003
      comp.release.value = 0.25
      comp.connect(ctx.destination)
      chordBusRef.current = comp
    }
    if (oscRef.current) { try { oscRef.current.stop() } catch { /* already stopped */ } oscRef.current = null }
    const now = ctx.currentTime
    midis.forEach((m, i) => {
      const freq = diapason * Math.pow(2, (m - 69) / 12)
      voice(ctx, freq, now + i * strum, duration, 0.5, chordBusRef.current)
    })
  }, [ensureCtx, voice])

  return { playNote, playChord }
}
