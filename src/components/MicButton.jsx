export default function MicButton({ listening, error, onStart, onStop }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={listening ? onStop : onStart}
        className={`
          relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200
          ${listening
            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30'
            : 'bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700'}
        `}
        aria-label={listening ? 'Stop microphone' : 'Start microphone'}
      >
        {listening && (
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
        )}
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${listening ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
        </svg>
      </button>
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        {listening ? 'Listening' : 'Start'}
      </span>
      {error && (
        <span className="text-xs text-red-500 dark:text-red-400 text-center max-w-[180px] leading-snug">
          {error === 'Microphone access denied.'
            ? 'Mic access denied. Allow it in browser settings and try again.'
            : error}
        </span>
      )}
    </div>
  )
}
