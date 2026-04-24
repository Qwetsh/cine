import { useNavigate } from 'react-router-dom'
import { useFriendMovieData } from '../../hooks/useFriendMovieData'
import { StarRating } from './StarRating'
import { Avatar } from '../ui/Avatar'

interface Props {
  tmdbId: number
  mediaType: 'movie' | 'tv'
}

export function FriendsCard({ tmdbId, mediaType }: Props) {
  const navigate = useNavigate()
  const { entries, loading } = useFriendMovieData(tmdbId, mediaType)

  if (loading || entries.length === 0) return null

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 mt-4">
      <h3 className="font-semibold text-[var(--color-text)] text-sm mb-3">Mes amis</h3>
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <button
            key={i}
            onClick={() => navigate(`/friend/${entry.user_id}`)}
            className="flex items-start gap-3 w-full text-left hover:bg-[var(--color-surface-2)] -mx-2 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Avatar name={entry.display_name} id={entry.user_id} size="xs" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text)]">{entry.display_name}</p>
              {entry.relation === 'wants_to_watch' ? (
                <p className="text-xs text-[var(--color-accent)]">Veut le voir</p>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  {entry.rating != null && (
                    <StarRating value={entry.rating} readOnly size="sm" />
                  )}
                  {entry.note && (
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      « {entry.note} »
                    </p>
                  )}
                  {!entry.rating && !entry.note && (
                    <p className="text-xs text-[var(--color-text-muted)]">A vu</p>
                  )}
                </div>
              )}
            </div>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-[var(--color-text-muted)] flex-shrink-0 mt-1"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
