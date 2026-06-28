export default function MicButton({ listening, onStart, onStop }) {
  return (
    <button
      onClick={listening ? onStop : onStart}
      className={`
        group relative w-14 h-14 rounded-full flex items-center justify-center shrink-0
        transition-all duration-200 ease-out active:scale-[0.94]
        ${listening
          ? 'bg-emerald-500 shadow-[0_0_26px_rgba(16,185,129,0.45)]'
          : 'bg-gradient-to-b from-zinc-100 to-zinc-200 border border-zinc-300 hover:from-white hover:to-zinc-100 dark:from-zinc-700 dark:to-zinc-800 dark:border-zinc-600/80 dark:hover:from-zinc-600 dark:hover:to-zinc-700'}
      `}
      aria-label={listening ? 'Stop microphone' : 'Start microphone'}
    >
      {listening && (
        <>
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
          <span className="absolute -inset-[5px] rounded-full border border-emerald-400/40" />
        </>
      )}
      {/* Top sheen for a tactile, glassy cap */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent" />
      <svg xmlns="http://www.w3.org/2000/svg"
        className={`relative w-6 h-6 transition-colors ${listening ? 'text-white' : 'text-zinc-500 dark:text-zinc-300'}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
      </svg>
    </button>
  )
}
