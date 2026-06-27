import { useRef, useState, useCallback, useEffect } from 'react'
import { PitchDetector } from 'pitchy'
import { SETTINGS_DEFAULTS } from './useSettings'

// Try ÷2, ×1, ×2 and pick whichever is nearest to reference (single octave correction)
function nearestOctave(detected, reference, minFreq, maxFreq) {
  const candidates = [detected / 2, detected, detected * 2].filter(p => p >= minFreq && p <= maxFreq)
  return candidates.reduce((best, p) =>
    Math.abs(Math.log2(p / reference)) < Math.abs(Math.log2(best / reference)) ? p : best
  )
}

export function usePitchDetector(settingsRef, stringsRef) {
  const [isListening, setIsListening] = useState(false)
  const [pitch, setPitch] = useState(null)
  const [error, setError] = useState(null)

  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const bufferRef = useRef(null)
  const smoothedPitchRef = useRef(null)
  const lastValidAtRef = useRef(null)

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    smoothedPitchRef.current = null
    lastValidAtRef.current = null
    setIsListening(false)
    setPitch(null)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      })
      // With the mic live, iOS routes output to the earpiece by default. 'play-and-record'
      // maps to AVAudioSession's .defaultToSpeaker — i.e. speakerphone — so the reference
      // tone comes out the loud bottom speaker instead.
      if ('audioSession' in navigator) {
        try { navigator.audioSession.type = 'play-and-record' } catch { /* unsupported */ }
      }
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      analyser.smoothingTimeConstant = 0.0

      const source = ctx.createMediaStreamSource(stream)
      source.connect(analyser)
      streamRef.current = stream

      const detector = PitchDetector.forFloat32Array(analyser.fftSize)
      const buffer = new Float32Array(detector.inputLength)

      audioCtxRef.current = ctx
      analyserRef.current = analyser
      sourceRef.current = source
      detectorRef.current = detector
      bufferRef.current = buffer

      setIsListening(true)

      const MIN_FREQ = 70
      const MAX_FREQ = 660

      const loop = () => {
        // Read latest settings on every frame — no restart needed
        const s = settingsRef?.current ?? SETTINGS_DEFAULTS

        analyser.getFloatTimeDomainData(buffer)

        let rms = 0
        for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i]
        rms = Math.sqrt(rms / buffer.length)

        if (rms >= s.noiseGate) {
          const [detectedPitch, clarity] = detector.findPitch(buffer, ctx.sampleRate)
          if (clarity >= s.clarityThreshold && detectedPitch >= MIN_FREQ && detectedPitch <= MAX_FREQ) {
            const prev = smoothedPitchRef.current
            if (prev === null) {
              smoothedPitchRef.current = detectedPitch
            } else {
              const jumpCents = Math.abs(1200 * Math.log2(detectedPitch / prev))
              if (jumpCents > s.resetThreshold) {
                const strings = stringsRef?.current
                let bestCandidate
                if (strings && strings.length > 0) {
                  // Prefer detected pitch on ties (detected-first + strict <) so that
                  // on 12-string, playing E3 beats the ÷2=E2 candidate even though both
                  // are 0 cents from a real string.
                  const candidates = [detectedPitch, detectedPitch / 2, detectedPitch * 2]
                    .filter(p => p >= MIN_FREQ && p <= MAX_FREQ)
                  let minDist = Infinity
                  bestCandidate = detectedPitch
                  for (const candidate of candidates) {
                    for (const s of strings) {
                      const dist = Math.abs(1200 * Math.log2(candidate / s.freq))
                      if (dist < minDist) { minDist = dist; bestCandidate = candidate }
                    }
                  }
                } else {
                  bestCandidate = nearestOctave(detectedPitch, prev, MIN_FREQ, MAX_FREQ)
                }
                const correctedJump = Math.abs(1200 * Math.log2(bestCandidate / prev))
                if (correctedJump <= s.rejectThreshold) {
                  smoothedPitchRef.current = prev * (1 - s.smoothFactor) + bestCandidate * s.smoothFactor
                } else {
                  smoothedPitchRef.current = detectedPitch
                }
              } else if (jumpCents > s.rejectThreshold) {
                // outlier — discard
              } else {
                smoothedPitchRef.current = prev * (1 - s.smoothFactor) + detectedPitch * s.smoothFactor
              }
            }
            lastValidAtRef.current = performance.now()
            setPitch(smoothedPitchRef.current)
          } else {
            const elapsed = performance.now() - (lastValidAtRef.current ?? 0)
            if (elapsed >= s.holdMs || smoothedPitchRef.current === null) {
              smoothedPitchRef.current = null
              setPitch(null)
            }
          }
        } else {
          const elapsed = performance.now() - (lastValidAtRef.current ?? 0)
          if (elapsed >= s.holdMs || smoothedPitchRef.current === null) {
            smoothedPitchRef.current = null
            setPitch(null)
          }
        }

        rafRef.current = requestAnimationFrame(loop)
      }

      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Microphone access denied.' : err.message)
      setIsListening(false)
    }
  }, [settingsRef, stringsRef])

  useEffect(() => () => stop(), [stop])

  return { isListening, pitch, error, start, stop }
}
