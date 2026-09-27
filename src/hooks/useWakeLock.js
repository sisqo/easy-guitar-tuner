import { useEffect } from 'react'

// Keeps the screen on while `active`. Tuning takes both hands — one on the peg,
// one plucking — and a phone that dims halfway through the low E is the one
// thing nobody wants to reach for. The browser drops the lock whenever the page
// is hidden, so it is re-requested each time the page comes back.
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock = null
    let cancelled = false

    async function acquire() {
      if (document.visibilityState !== 'visible') return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (cancelled) l.release().catch(() => {})
        else lock = l
      } catch {
        // denied (battery saver, unsupported iframe…) — the tuner still works
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [active])
}
