import { useRef, useState, useCallback, useEffect } from 'react'
import { PitchDetector } from 'pitchy'
import { SETTINGS_DEFAULTS } from '../data/settings'
import { createTrackerState, trackPitch, cents } from '../utils/pitchTracker'

// A 4096-sample window at 48 kHz turns over every 85 ms, so consecutive analyses
// share ~80% of their samples — running the detector once per animation frame is
// mostly redundant FFT work. 30 ms keeps all the independent information the
// analyser can actually give while leaving the main thread to the UI.
const ANALYSIS_INTERVAL_MS = 30

// Republish only once the reading has really moved. A parked string then stops
// re-rendering the tree altogether, instead of pushing a new float 60 times a
// second and dragging the headstock SVG along with it.
const PUBLISH_CENTS = 0.3

const VALID_WINDOWS = [4096, 8192, 16384]

function windowSizeOf(settings) {
  return VALID_WINDOWS.includes(settings.windowSize)
    ? settings.windowSize
    : SETTINGS_DEFAULTS.windowSize
}

export function usePitchDetector(settingsRef, stringsRef) {
  const [isListening, setIsListening] = useState(false)
  const [pitch, setPitch] = useState(null)
  const [error, setError] = useState(null)

  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const trackerRef = useRef(createTrackerState())

  // Read by DebugOverlay at its own pace. A ref, not state: the whole point of
  // the instrumentation is that observing the detector must not change how often
  // the app renders.
  const statsRef = useRef({
    rawHz: 0, clarity: 0, rms: 0, smoothedHz: null, gate: 'idle',
    acceptedPerSec: 0, analysesPerSec: 0, windowSize: 0, sampleRate: 0,
  })

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
    analyserRef.current = null
    trackerRef.current = createTrackerState()
    statsRef.current = { ...statsRef.current, gate: 'idle', smoothedHz: null, rawHz: 0, clarity: 0, rms: 0 }
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
      const settings = settingsRef?.current ?? SETTINGS_DEFAULTS

      let windowSize = windowSizeOf(settings)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = windowSize
      // No-op for getFloatTimeDomainData (it only smooths the frequency-domain
      // reads), but it documents that nothing is averaged behind our back.
      analyser.smoothingTimeConstant = 0.0

      // Wired once and never rewired: only the frequencies are live-adjustable, so
      // changing a filter setting never has to tear down the AudioContext.
      // The lowpass is the real defence against octave-up errors — it removes the
      // upper partials that tempt MPM into picking the half-period peak. The
      // highpass takes out handling rumble and DC, which otherwise inflate the RMS
      // and make the noise gate meaningless.
      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = settings.hpFreq
      highpass.Q.value = 0.7

      const lowpass = ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = settings.lpFreq
      lowpass.Q.value = 0.7

      const source = ctx.createMediaStreamSource(stream)
      source.connect(highpass)
      highpass.connect(lowpass)
      lowpass.connect(analyser)
      streamRef.current = stream

      let detector = PitchDetector.forFloat32Array(windowSize)
      let buffer = new Float32Array(detector.inputLength)
      // pitchy exposes clarityThreshold as a setter with no getter, so the applied
      // value has to be tracked here. It is MPM's k — which NSDF peak counts as the
      // period — so it governs octave selection, unlike settings.clarityThreshold
      // which only decides whether a finished reading is trusted.
      let appliedK = null

      audioCtxRef.current = ctx
      analyserRef.current = analyser
      sourceRef.current = source
      trackerRef.current = createTrackerState()

      setIsListening(true)

      let lastAnalysisAt = 0
      let published = null
      let analyses = 0
      let accepted = 0
      let counterAt = performance.now()

      const loop = () => {
        rafRef.current = requestAnimationFrame(loop)

        // Read latest settings on every frame — no restart needed
        const s = settingsRef?.current ?? SETTINGS_DEFAULTS
        const now = performance.now()

        if (highpass.frequency.value !== s.hpFreq) highpass.frequency.value = s.hpFreq
        if (lowpass.frequency.value !== s.lpFreq) lowpass.frequency.value = s.lpFreq

        if (now - lastAnalysisAt < ANALYSIS_INTERVAL_MS) return
        lastAnalysisAt = now

        const wanted = windowSizeOf(s)
        if (wanted !== windowSize) {
          windowSize = wanted
          analyser.fftSize = windowSize
          detector = PitchDetector.forFloat32Array(windowSize)
          buffer = new Float32Array(detector.inputLength)
          appliedK = null
          trackerRef.current = createTrackerState()
        }
        if (s.mpmK !== appliedK) {
          detector.clarityThreshold = s.mpmK
          appliedK = s.mpmK
        }

        analyser.getFloatTimeDomainData(buffer)

        let rms = 0
        for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i]
        rms = Math.sqrt(rms / buffer.length)

        let rawHz = 0
        let clarity = 0
        if (rms >= s.noiseGate) {
          [rawHz, clarity] = detector.findPitch(buffer, ctx.sampleRate)
        }

        const { hz, gate } = trackPitch(
          trackerRef.current,
          { rawHz, clarity, rms, now, windowMs: (windowSize / ctx.sampleRate) * 1000 },
          s,
          stringsRef?.current ?? [],
        )

        if (hz === null) {
          if (published !== null) {
            published = null
            setPitch(null)
          }
        } else if (published === null || Math.abs(cents(hz, published)) >= PUBLISH_CENTS) {
          published = hz
          setPitch(hz)
        }

        analyses++
        if (gate === 'ok') accepted++
        const stats = statsRef.current
        stats.rawHz = rawHz
        stats.clarity = clarity
        stats.rms = rms
        stats.smoothedHz = hz
        stats.gate = gate
        stats.windowSize = windowSize
        stats.sampleRate = ctx.sampleRate
        const span = now - counterAt
        if (span >= 1000) {
          stats.analysesPerSec = Math.round((analyses * 1000) / span)
          stats.acceptedPerSec = Math.round((accepted * 1000) / span)
          analyses = 0
          accepted = 0
          counterAt = now
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      setError(err.name === 'NotAllowedError' ? 'Microphone access denied.' : err.message)
      setIsListening(false)
    }
  }, [settingsRef, stringsRef])

  useEffect(() => () => stop(), [stop])

  return { isListening, pitch, error, start, stop, statsRef }
}
