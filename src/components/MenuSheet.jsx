import BottomSheet, { Chip, Segmented } from './BottomSheet'

const KOFI_URL = 'https://ko-fi.com/sisqo'

function Row({ icon, children, ...rest }) {
  const Tag = rest.href ? 'a' : 'button'
  return (
    <Tag
      className="flex items-center gap-3 h-12 px-3.5 w-full text-left text-sm text-ink whitespace-nowrap hover:bg-well transition-colors cursor-pointer"
      {...rest}
    >
      {icon}
      {children}
    </Tag>
  )
}

const Divider = () => <div className="h-px bg-line ml-[42px]" />

// Instrument and tuning are chips rather than <select>s: every option is visible
// and one tap away, and the sheet has the room a dropdown did not.
export default function MenuSheet({
  open, onClose, dark, onToggleTheme, onOpenSettings, showInstallOption, onInstall,
  instrument, instruments, onInstrumentChange, tuningKey, tunings, onTuningChange,
  view, onViewChange,
}) {
  function then(fn) { return (...a) => { onClose(); fn(...a) } }

  return (
    <BottomSheet open={open} onClose={onClose} label="Menu">
      <Segmented
        options={[['tuner', 'Tuner'], ['chords', 'Chords']]}
        value={view}
        onChange={then(onViewChange)}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted px-0.5">Instrument</span>
        <div className="grid grid-cols-3 gap-1.5">
          {instruments.map(i => (
            <Chip key={i.id} selected={i.id === instrument} onClick={() => onInstrumentChange(i.id)}
              className="h-10 rounded-xl text-[13px]">
              {i.label}
            </Chip>
          ))}
        </div>
      </div>

      {view !== 'chords' && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted px-0.5">Tuning</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(tunings).map(([key, t]) => (
              <Chip key={key} selected={key === tuningKey} onClick={() => onTuningChange(key)}
                className="h-9 px-3 rounded-full text-[13px]">
                {t.label.split('(')[0].trim()}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col rounded-2xl bg-card border border-line overflow-hidden">
        <Row onClick={then(onOpenSettings)} icon={
          <svg className="w-4 h-4 shrink-0 text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }>
          Settings
        </Row>
        <Divider />
        <Row onClick={onToggleTheme} icon={
          <svg className="w-4 h-4 shrink-0 text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={dark
              ? 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 5a7 7 0 100 14A7 7 0 0012 5z'
              : 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z'} />
          </svg>
        }>
          {dark ? 'Light mode' : 'Dark mode'}
        </Row>
        {showInstallOption && (
          <>
            <Divider />
            <Row onClick={then(onInstall)} icon={
              <svg className="w-4 h-4 shrink-0 text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }>
              Add to Home Screen
            </Row>
          </>
        )}
        <Divider />
        <Row href={KOFI_URL} target="_blank" rel="noopener noreferrer" onClick={onClose} icon={
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#72a4f2">
            <path d="M2 3h18.5a1.5 1.5 0 0 1 0 3H19l-1.5 13A2 2 0 0 1 15.5 21h-7a2 2 0 0 1-2-1.8L5 7H2V3zm7.5 5a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5A.75.75 0 0 0 9.5 8zm3.5 0a.75.75 0 0 0-.75.75v5.5a.75.75 0 0 0 1.5 0v-5.5A.75.75 0 0 0 13 8z" />
          </svg>
        }>
          Buy me a coffee
        </Row>
      </div>
    </BottomSheet>
  )
}
