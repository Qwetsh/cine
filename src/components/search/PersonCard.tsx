import { useNavigate } from 'react-router-dom'
import type { TmdbPersonDetail } from '../../lib/tmdb'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

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
  const navigate = useNavigate()
  const isDirector = person.known_for_department === 'Directing'
  const role = isDirector ? 'Realisateur' : 'Acteur'
  const age = getAge(person.birthday, person.deathday)

  return (
    <div className="mt-1 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {person.profile_path ? (
          <img
            src={`${TMDB_IMG}/w185${person.profile_path}`}
            alt={person.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-[var(--color-border)] flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-xl border-2 border-[var(--color-border)] flex-shrink-0">
            {isDirector ? '🎬' : '🎭'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm text-[var(--color-text)] leading-tight truncate">{person.name}</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {role} · {filmCount} film{filmCount > 1 ? 's' : ''}
            {age != null && <> · {age} ans</>}
          </p>
        </div>

        <button
          onClick={() => navigate(`/person/${person.id}`)}
          className="flex items-center gap-1 bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex-shrink-0 border border-[var(--color-border)]"
        >
          Infos
        </button>
      </div>
    </div>
  )
}
