import { useState } from 'react'
import type { TmdbPersonDetail } from '../../lib/tmdb'

const TMDB_IMG = 'https://image.tmdb.org/t/p'
const BIO_PREVIEW_LENGTH = 200

interface Props {
  person: TmdbPersonDetail
  filmCount: number
}

function getAge(birthday: string | null, deathday: string | null): number | null {
  if (!birthday) return null
  const birth = new Date(birthday)
  const end = deathday ? new Date(deathday) : new Date()
  let age = end.getFullYear() - birth.getFullYear()
  const m = end.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--
  return age
}

export function PersonCard({ person, filmCount }: Props) {
  const [expanded, setExpanded] = useState(false)

  const isDirector = person.known_for_department === 'Directing'
  const role = isDirector ? 'Realisateur' : 'Acteur'
  const age = getAge(person.birthday, person.deathday)
  const hasBio = person.biography && person.biography.length > 0
  const isLongBio = hasBio && person.biography.length > BIO_PREVIEW_LENGTH

  return (
    <div className="mx-4 mt-2 mb-1 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 p-3">
        {person.profile_path ? (
          <img
            src={`${TMDB_IMG}/w185${person.profile_path}`}
            alt={person.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-[var(--color-border)] flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-2xl border-2 border-[var(--color-border)] flex-shrink-0">
            {isDirector ? '🎬' : '🎭'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-[var(--color-text)] leading-tight truncate">{person.name}</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {role} · {filmCount} film{filmCount > 1 ? 's' : ''}
            {age != null && (
              <> · {person.deathday ? `${age} ans (decede)` : `${age} ans`}</>
            )}
          </p>
          {person.place_of_birth && (
            <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
              {person.place_of_birth}
            </p>
          )}
        </div>
      </div>

      {/* Biography */}
      {hasBio && (
        <div className="px-3 pb-3">
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
        </div>
      )}
    </div>
  )
}
