import { useState } from 'react'
import { SETTINGS_DEFAULTS } from '../hooks/useSettings'

function InfoBox({ text }) {
  return (
    <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/80 rounded-lg px-3 py-2 leading-relaxed border border-zinc-100 dark:border-zinc-700/60">
      {text}
    </div>
  )
}

function Slider({ label, description, info, settingKey, value, min, max, step, format, update }) {
  const [showInfo, setShowInfo] = useState(false)
  const isDefault = value === SETTINGS_DEFAULTS[settingKey]
  const display = format ? format(value) : value

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</span>
          {info && (
            <button
              onClick={() => setShowInfo(v => !v)}
              aria-label={`Info: ${label}`}
              aria-expanded={showInfo}
              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center border transition-colors text-[10px] font-bold leading-none shrink-0 ${
                showInfo
                  ? 'bg-[#2aab9e]/10 border-[#2aab9e] text-[#2aab9e]'
                  : 'border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-[#2aab9e] hover:text-[#2aab9e]'
              }`}
            >i</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono tabular-nums text-[#2aab9e]">{display}</span>
          {!isDefault && (
            <button
              onClick={() => update(settingKey, SETTINGS_DEFAULTS[settingKey])}
              className="text-xs text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
              title="Reset to default"
            >↺</button>
          )}
        </div>
      </div>
      {showInfo && <InfoBox text={info} />}
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => update(settingKey, parseFloat(e.target.value))}
        className="egt-range w-full text-zinc-200 dark:text-zinc-700"
      />
      <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-600">
        <span>{format ? format(min) : min}</span>
        {description && <span className="text-center px-2">{description}</span>}
        <span>{format ? format(max) : max}</span>
      </div>
    </div>
  )
}

export default function SettingsPanel({ open, onClose, settings, update, resetAll }) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      )}

      <div className={`fixed top-0 right-0 h-full z-50 w-full max-w-sm bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-7">

          {/* Tuning */}
          <section className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Tuning</h3>
            <Slider
              label="Reference pitch" settingKey="diapason"
              value={settings.diapason} min={432} max={446} step={1}
              format={v => `${v} Hz`}
              description="Standard A4"
              info="Sets the A4 frequency all note targets are calculated from. Standard concert pitch is 440 Hz. Lower values (e.g. 432 Hz) are used for alternative tuning standards."
              update={update}
            />
          </section>

          {/* Display */}
          <section className="flex flex-col gap-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">Display</h3>
            <Slider
              label="In-tune zone" settingKey="inTuneThreshold"
              value={settings.inTuneThreshold} min={1} max={15} step={1}
              format={v => `±${v} ¢`}
              description="Green zone width"
              info="How many cents off-centre a string can be and still count as in tune. A wider zone is easier to hit; a narrower zone requires more precision."
              update={update}
            />
            <Slider
              label="Bar smoothing" settingKey="displaySmooth"
              value={settings.displaySmooth} min={0.05} max={0.40} step={0.01}
              format={v => v.toFixed(2)}
              description="Needle fluidity"
              info="Controls how fluidly the needle moves. Lower values react faster but may feel jittery; higher values are smoother but slower to follow pitch changes."
              update={update}
            />
          </section>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
          >
            <span>Detection (Advanced)</span>
            <span>{showAdvanced ? '▲' : '▼'}</span>
          </button>

          {showAdvanced && (
            <section className="flex flex-col gap-5 -mt-4">
              <Slider
                label="Noise gate" settingKey="noiseGate"
                value={settings.noiseGate} min={0.001} max={0.02} step={0.001}
                format={v => v.toFixed(3)}
                description="Min RMS"
                info="Minimum signal level required before pitch detection activates. Raise it if the tuner picks up ambient noise; lower it if notes are cut off too early during quiet playing."
                update={update}
              />
              <Slider
                label="Clarity threshold" settingKey="clarityThreshold"
                value={settings.clarityThreshold} min={0.70} max={0.98} step={0.01}
                format={v => v.toFixed(2)}
                description="McLeod confidence"
                info="Confidence level required from the pitch detector before accepting a reading. Higher values give fewer false positives but may drop quiet or complex notes."
                update={update}
              />
              <Slider
                label="EMA smoothing" settingKey="smoothFactor"
                value={settings.smoothFactor} min={0.05} max={0.50} step={0.01}
                format={v => v.toFixed(2)}
                description="Pitch reactivity"
                info="Smoothing applied to the raw pitch signal between frames. Lower = faster and more reactive; higher = smoother but slower to follow rapid pitch changes."
                update={update}
              />
              <Slider
                label="Note hold" settingKey="holdMs"
                value={settings.holdMs} min={200} max={3000} step={100}
                format={v => `${v} ms`}
                description="After silence"
                info="How long the last detected note is displayed after the signal goes quiet. Longer values prevent the reading from disappearing during natural string decay."
                update={update}
              />
              <Slider
                label="Outlier gate" settingKey="rejectThreshold"
                value={settings.rejectThreshold} min={10} max={80} step={5}
                format={v => `${v} ¢`}
                description="Discard small jumps"
                info="Pitch jumps larger than this value between consecutive frames are discarded as noise. Helps reject string buzz, fret rattle, and sudden detection spikes."
                update={update}
              />
              <Slider
                label="String change" settingKey="resetThreshold"
                value={settings.resetThreshold} min={50} max={200} step={10}
                format={v => `${v} ¢`}
                description="New string threshold"
                info="When the detected pitch jumps by more than this amount, the tuner switches to tracking a new string. Lower = switches strings faster; higher = stays on one string longer."
                update={update}
              />
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={resetAll}
            className="w-full py-2.5 rounded-xl text-sm font-medium text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  )
}
