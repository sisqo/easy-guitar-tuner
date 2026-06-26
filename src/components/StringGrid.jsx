import StringCard from './StringCard'

export default function StringGrid({ strings, closestStringId, closestCents, lockedStringId, onLockToggle, onPlay }) {
  const cols = strings.length === 4
    ? 'grid-cols-2'
    : strings.length === 12
    ? 'grid-cols-3 sm:grid-cols-4'
    : 'grid-cols-2 sm:grid-cols-3'

  return (
    <div className={`grid ${cols} gap-2`}>
      {strings.map(s => {
        const isLocked = lockedStringId === s.id
        const isActive = isLocked
          ? true
          : lockedStringId === null && closestStringId === s.id
        const cents = isLocked || (lockedStringId === null && closestStringId === s.id)
          ? closestCents
          : null

        return (
          <StringCard
            key={s.id}
            string={s}
            active={isActive}
            cents={cents}
            locked={isLocked}
            onLockToggle={onLockToggle}
            onPlay={onPlay}
          />
        )
      })}
    </div>
  )
}
