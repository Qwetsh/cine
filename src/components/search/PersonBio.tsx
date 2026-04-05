import { useState } from 'react'

const BIO_PREVIEW_LENGTH = 200

interface PersonLike {
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
}

interface Props {
  person: PersonLike
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getAge(birthday: string, deathday: string | null): number {
  const birth = new Date(birthday)
  const end = deathday ? new Date(deathday) : new Date()
  let age = end.getFullYear() - birth.getFullYear()
  const m = end.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--
  return age
}

export function PersonBio({ person }: Props) {
  const [expanded, setExpanded] = useState(false)

  const hasBio = person.biography && person.biography.length > 0
  const hasInfo = person.birthday || person.place_of_birth
  if (!hasBio && !hasInfo) return null

  const isLongBio = hasBio && person.biography.length > BIO_PREVIEW_LENGTH

  return (
    <div className="mx-4 mb-2">
      {/* Date / lieu */}
      {hasInfo && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)] mb-1.5">
          {person.birthday && (
            <span>
              {formatDate(person.birthday)}
              {person.deathday
                ? ` — ${formatDate(person.deathday)} (${getAge(person.birthday, person.deathday)} ans)`
                : ` (${getAge(person.birthday, null)} ans)`}
            </span>
          )}
          {person.place_of_birth && <span>{person.place_of_birth}</span>}
        </div>
      )}

      {/* Bio text */}
      {hasBio && (
        <>
          <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
            {expanded || !isLongBio
              ? person.biography
              : person.biography.slice(0, BIO_PREVIEW_LENGTH) + '…'}
          </p>
          {isLongBio && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-xs text-[var(--color-accent)] mt-1 font-medium"
            >
              {expanded ? 'Voir moins' : 'Voir plus'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
