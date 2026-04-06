import { useFriendMovieData } from '../../hooks/useFriendMovieData'
import { StarRating } from './StarRating'

interface Props {
  tmdbId: number
  mediaType: 'movie' | 'tv'
}

export function FriendsCard({ tmdbId, mediaType }: Props) {
  const { entries, loading } = useFriendMovieData(tmdbId, mediaType)

  if (loading || entries.length === 0) return null

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 mt-4">
      <h3 className="font-semibold text-[var(--color-text)] text-sm mb-3">Mes amis</h3>
      <div className="space-y-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
              👤
            </div>
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
          </div>
        ))}
      </div>
    </div>
  )
}
