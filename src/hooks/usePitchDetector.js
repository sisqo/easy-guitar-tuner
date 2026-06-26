import { useRef, useState, useCallback, useEffect } from 'react'
import { PitchDetector } from 'pitchy'

const NOISE_GATE_RMS = 0.01
const CLARITY_THRESHOLD = 0.85

export function usePitchDetector() {
  const [isListening, setIsListening] = useState(false)
  const [pitch, setPitch] = useState(null)
  const [error, setError] = useState(null)

  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const detectorRef = useRef(null)
  const rafRef = useRef(null)
  const bufferRef = useRef(null)

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current.mediaStream?.getTracks().forEach(t => t.stop())
      sourceRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setIsListening(false)
    setPitch(null)
  }, [])

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.1

      const source = ctx.createMediaStreamSource(stream)
      source.mediaStream = stream
      source.connect(analyser)

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
            setPitch(detectedPitch)
          } else {
            setPitch(null)
          }
        } else {
          setPitch(null)
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
