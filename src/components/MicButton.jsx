export default function MicButton({ listening, onStart, onStop }) {
  return (
    <button
      onClick={listening ? onStop : onStart}
      aria-label={listening ? 'Stop microphone' : 'Start microphone'}
      className={`relative w-[60px] h-[60px] rounded-full flex items-center justify-center shrink-0 cursor-pointer
        transition-[background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.94]
        ${listening ? 'bg-emerald-500' : 'bg-surface border border-line'}`}
      style={{
        boxShadow: listening
          ? '0 0 0 6px rgba(16,185,129,0.14), 0 0 28px rgba(16,185,129,0.35)'
          : 'var(--mic-idle-shadow)',
      }}
    >
      {/* Listening: a ping outwards. Off: a slow breath, the one thing on screen
          asking to be tapped. */}
      {listening
        ? <span className="egt-ping absolute inset-0 rounded-full bg-emerald-500 opacity-25" />
        : <span className="egt-breathe absolute -inset-px rounded-full" />}
      <svg className={`relative w-6 h-6 ${listening ? 'text-white' : 'text-ink-2'}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
      </svg>
    </button>
  )
}
