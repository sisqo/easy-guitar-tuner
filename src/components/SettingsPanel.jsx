import { useState } from 'react'
import { SETTINGS_DEFAULTS } from '../data/settings'

function InfoBox({ text }) {
  return (
    <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/80 rounded-lg px-3 py-2 leading-relaxed border border-zinc-100 dark:border-zinc-700/60">
      {text}
    </div>
  )
}

// Label, info toggle, current value and per-setting reset — shared by every kind
// of control below so they line up and behave the same way.
function Head({ label, info, settingKey, value, display, update }) {
  const [showInfo, setShowInfo] = useState(false)
  const isDefault = value === SETTINGS_DEFAULTS[settingKey]

  return (
    <>
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
          {display !== null && <span className="text-sm font-mono tabular-nums text-[#2aab9e]">{display}</span>}
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
    </>
  )
}

function Slider({ label, description, info, settingKey, value, min, max, step, format, update }) {
  const display = format ? format(value) : value

  return (
    <div className="flex flex-col gap-1.5">
      <Head label={label} info={info} settingKey={settingKey} value={value} display={display} update={update} />
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

// For settings whose values are a short fixed set — a slider would imply a
// continuum that isn't there (fftSize must be a power of two).
function Choice({ label, description, info, settingKey, value, options, update }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Head label={label} info={info} settingKey={settingKey} value={value} display={null} update={update} />
      <div className="flex gap-1.5">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => update(settingKey, o.value)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono tabular-nums border transition-colors ${
              value === o.value
                ? 'bg-[#2aab9e]/10 border-[#2aab9e] text-[#2aab9e]'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500'
            }`}
          >{o.label}</button>
        ))}
      </div>
      {description && (
        <div className="text-xs text-zinc-400 dark:text-zinc-600 text-center">{description}</div>
      )}
    </div>
  )
}

function Toggle({ label, description, info, settingKey, value, update }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Head label={label} info={info} settingKey={settingKey} value={value} display={null} update={update} />
          {description && (
            <div className="text-xs text-zinc-400 dark:text-zinc-600">{description}</div>
          )}
        </div>
        <button
          role="switch"
          aria-checked={value}
          aria-label={label}
          onClick={() => update(settingKey, !value)}
          className={`shrink-0 w-10 h-6 rounded-full border transition-colors ${
            value ? 'bg-[#2aab9e] border-[#2aab9e]' : 'bg-zinc-200 dark:bg-zinc-700 border-transparent'
          }`}
        >
          <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-[3px]'}`} />
        </button>
      </div>
    </div>
  )
}

function SubHeading({ children }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 pt-1">
      {children}
    </h4>
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
            <Choice
              label="Bar range" settingKey="barRange"
              value={settings.barRange}
              options={[{ value: 15, label: '±15 ¢' }, { value: 25, label: '±25 ¢' }, { value: 50, label: '±50 ¢' }]}
              description="Full scale of the bar"
              info="How many cents the full width of the bar covers. A narrower range magnifies small errors — at ±25 the needle travels twice as far for the same three cents as it did at ±50, which is what makes fine tuning visible at all."
              update={update}
            />
            <Slider
              label="Bar smoothing" settingKey="displaySmooth"
              value={settings.displaySmooth} min={0.05} max={0.40} step={0.01}
              format={v => v.toFixed(2)}
              description="Needle fluidity"
              info="Controls how fluidly the needle glides. This is purely visual — the detector has already smoothed the pitch — so higher values simply track the reading more closely."
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
              <SubHeading>Signal</SubHeading>
              <Choice
                label="Analysis window" settingKey="windowSize"
                value={settings.windowSize}
                options={[{ value: 4096, label: '4096' }, { value: 8192, label: '8192' }, { value: 16384, label: '16384' }]}
                description="Samples per analysis"
                info="How much audio each pitch estimate is measured over. At 48 kHz, 4096 samples is 85 ms — only about five and a half cycles of a low C, which is why bass strings read unsteadily. Doubling it doubles the cycles and steadies the low strings, at the cost of the same amount of latency."
                update={update}
              />
              <Slider
                label="Highpass" settingKey="hpFreq"
                value={settings.hpFreq} min={40} max={90} step={5}
                format={v => `${v} Hz`}
                description="Cut rumble"
                info="Removes handling noise, room rumble and DC offset before the detector sees the signal. Keep it below the lowest note you tune — Drop C's low C is 65 Hz."
                update={update}
              />
              <Slider
                label="Lowpass" settingKey="lpFreq"
                value={settings.lpFreq} min={600} max={3000} step={100}
                format={v => `${v} Hz`}
                description="Cut partials"
                info="Removes the upper harmonics that tempt the detector into reporting a note an octave too high. Lower it if you get octave errors; raise it if thin strings stop being detected."
                update={update}
              />
              <Slider
                label="Noise gate" settingKey="noiseGate"
                value={settings.noiseGate} min={0.0005} max={0.01} step={0.0005}
                format={v => v.toFixed(4)}
                description="Absolute floor, RMS"
                info="The quietest signal, measured after the filters, that pitch detection will run on at all. The tuner also learns the room: the working gate sits about 4 dB above the quietest level it has heard recently and comes back down the moment things get quieter, so this floor only matters in a very quiet room. Raise it if the tuner reacts to room noise; lower it if quiet plucks are ignored."
                update={update}
              />
              <Slider
                label="Clarity (new note)" settingKey="clarityThreshold"
                value={settings.clarityThreshold} min={0.40} max={0.90} step={0.01}
                format={v => v.toFixed(2)}
                description="Confidence to show a note"
                info="How periodic the signal must be before a note that is not already on screen gets shown. A string plucked while the others still ring only holds part of the energy, so this is deliberately moderate — which string you just played is decided from the spectrum, not from this number. Too high and you have to mute the other strings to see anything; too low and noise gets through."
                update={update}
              />
              <Slider
                label="Clarity (tracking)" settingKey="clarityTrack"
                value={settings.clarityTrack} min={0.20} max={0.80} step={0.01}
                format={v => v.toFixed(2)}
                description="Confidence to keep following"
                info="How periodic the signal must stay for the note already on screen to keep updating. Lower than the threshold for a new note on purpose: a decaying string loses clarity long before it stops being the same note, and this is what keeps the reading alive to the end of the decay instead of freezing mid-tuning."
                update={update}
              />
              <Slider
                label="Period selection (k)" settingKey="mpmK"
                value={settings.mpmK} min={0.80} max={0.97} step={0.01}
                format={v => v.toFixed(2)}
                description="Octave control"
                info="The detector's threshold for deciding which repeat of the waveform counts as one cycle, as a fraction of the strongest repeat. This — not the clarity thresholds — is what decides octaves: raise it to make the detector skip weak half-period matches and stop reporting notes an octave high."
                update={update}
              />

              <SubHeading>Tracking</SubHeading>
              <Slider
                label="Smoothing (parked)" settingKey="smoothFactor"
                value={settings.smoothFactor} min={0.05} max={0.50} step={0.01}
                format={v => v.toFixed(2)}
                description="While the pitch is steady"
                info="Smoothing applied once the note has settled, expressed as the amount of catch-up per frame at 60 fps and rescaled to the real frame rate — so it behaves the same on a slow phone as on a desktop. Lower is steadier."
                update={update}
              />
              <Slider
                label="Smoothing (moving)" settingKey="smoothFactorFast"
                value={settings.smoothFactorFast} min={0.20} max={0.80} step={0.05}
                format={v => v.toFixed(2)}
                description="While a peg is turning"
                info="Smoothing used while the pitch is actually travelling. Keeping this separate is what lets the needle answer a peg turn immediately without becoming jittery once the string is parked."
                update={update}
              />
              <Slider
                label="Movement threshold" settingKey="fastGateCents"
                value={settings.fastGateCents} min={5} max={30} step={1}
                format={v => `${v} ¢`}
                description="Counts as moving"
                info="How far the reading has to be from the current one before the tuner treats the pitch as moving and switches to the faster smoothing."
                update={update}
              />
              <Slider
                label="Outlier gate" settingKey="rejectThreshold"
                value={settings.rejectThreshold} min={10} max={80} step={5}
                format={v => `${v} ¢`}
                description="Needs confirming"
                info="A reading further than this from the current note is not trusted on its own — it has to be confirmed by the readings that follow. Nothing is ever discarded outright, so a sustained new note always wins however far away it is."
                update={update}
              />
              <Slider
                label="Confirmation" settingKey="confirmFrames"
                value={settings.confirmFrames} min={2} max={6} step={1}
                format={v => `${v} reads`}
                description="Agreeing readings"
                info="How many agreeing readings it takes to accept a new note that arrives without an audible attack — a string that was already ringing when you started, or a peg turned past the outlier gate. A pluck the tuner hears as an onset switches on the very first reading regardless."
                update={update}
              />
              <Slider
                label="Note hold" settingKey="holdMs"
                value={settings.holdMs} min={200} max={3000} step={100}
                format={v => `${v} ms`}
                description="After silence"
                info="How long the last note stays on screen once the signal is gone. Long enough to survive a string's natural decay, short enough that a stale reading does not linger."
                update={update}
              />

              <SubHeading>Diagnostics</SubHeading>
              <Toggle
                label="Debug overlay" settingKey="debugOverlay"
                value={settings.debugOverlay}
                description="Show live detector stats"
                info="Shows the raw frequency, clarity, signal level, which gate the last reading hit, and how many readings per second are being accepted. Accepted-per-second is the one to watch: a low number is what a tuner that feels unresponsive actually looks like."
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
