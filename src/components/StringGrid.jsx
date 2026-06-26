import StringCard from './StringCard'

export default function StringGrid({ strings, closestStringId, closestCents, onPlay }) {
  const cols = strings.length === 4 ? 'grid-cols-2' : strings.length === 12 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'

  return (
    <div className={`grid ${cols} gap-2`}>
      {strings.map(s => (
        <StringCard
          key={s.id}
          string={s}
          active={closestStringId === s.id}
          cents={closestStringId === s.id ? closestCents : null}
          onPlay={onPlay}
        />
      ))}
    </div>
  )
}
