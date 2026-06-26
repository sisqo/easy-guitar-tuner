export default function MicButton({ listening, error, onStart, onStop }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={listening ? onStop : onStart}
        className={`
          relative w-10 h-10 rounded-full flex items-center justify-center transition-all
          ${listening
            ? 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/30'
            : 'bg-zinc-100 hover:bg-zinc-200 border-2 border-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-700'}
        `}
        aria-label={listening ? 'Stop microphone' : 'Start microphone'}
      >
        {listening && (
          <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30" />
        )}

        <svg xmlns="http://www.w3.org/2000/svg" className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
        </svg>

      </button>
      {error && (
        <span className="text-xs text-red-400 text-center max-w-xs">{error}</span>
      )}
    </div>
  )
}
