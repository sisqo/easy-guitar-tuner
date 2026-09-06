import { useState, useRef, useCallback } from 'react'

export function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item !== null ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  // The setter has to be stable *and* has to see the current value. It gets
  // captured by useCallbacks that outlive the render they were created in — the
  // preset actions are all like this — and two writes can land in the same tick.
  // Reading `stored` straight from the render closure fails both: renaming a preset
  // wrote its update over the library as it was when the callback was created,
  // which was before any preset existed.
  const latest = useRef(stored)
  latest.current = stored

  const setValue = useCallback((value) => {
    const next = typeof value === 'function' ? value(latest.current) : value
    latest.current = next
    setStored(next)
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // storage full or unavailable — the value still lives in state for this session
    }
  }, [key])

  return [stored, setValue]
}
