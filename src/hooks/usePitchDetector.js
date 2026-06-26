import { useRef, useState, useCallback, useEffect } from 'react'
import { PitchDetector } from 'pitchy'

const NOISE_GATE_RMS = 0.004
const CLARITY_THRESHOLD = 0.75
const SMOOTH_FACTOR = 0.25
const RESET_THRESHOLD_CENTS = 150
const HOLD_MS = 1500  // keep last reading visible after signal fades

export function usePitchDetector() {
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

      const loop = () => {
        analyser.getFloatTimeDomainData(buffer)

        let rms = 0
        for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i]
        rms = Math.sqrt(rms / buffer.length)

        if (rms >= NOISE_GATE_RMS) {
          const [detectedPitch, clarity] = detector.findPitch(buffer, ctx.sampleRate)
          if (clarity >= CLARITY_THRESHOLD && detectedPitch > 50 && detectedPitch < 2000) {
            const prev = smoothedPitchRef.current
            if (prev === null) {
              smoothedPitchRef.current = detectedPitch
            } else {
              const jumpCents = Math.abs(1200 * Math.log2(detectedPitch / prev))
              smoothedPitchRef.current = jumpCents > RESET_THRESHOLD_CENTS
                ? detectedPitch
                : prev * (1 - SMOOTH_FACTOR) + detectedPitch * SMOOTH_FACTOR
            }
            lastValidAtRef.current = performance.now()
            setPitch(smoothedPitchRef.current)
          } else {
            const elapsed = performance.now() - (lastValidAtRef.current ?? 0)
            if (elapsed < HOLD_MS && smoothedPitchRef.current !== null) {
              // hold last reading — don't update pitch
            } else {
              smoothedPitchRef.current = null
              setPitch(null)
            }
          }
        } else {
          const elapsed = performance.now() - (lastValidAtRef.current ?? 0)
          if (elapsed < HOLD_MS && smoothedPitchRef.current !== null) {
            // hold last reading during signal decay
          } else {
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
  }, [])

  useEffect(() => () => stop(), [stop])

  return { isListening, pitch, error, start, stop }
}
