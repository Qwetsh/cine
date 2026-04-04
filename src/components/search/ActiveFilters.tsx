import type { TmdbGenre, SearchFilters } from '../../lib/tmdb'

interface Props {
  filters: SearchFilters
  genres: TmdbGenre[]
  onRemoveGenre: (id: number) => void
  onRemoveYearRange: () => void
  onClearAll: () => void
}

export function ActiveFilters({ filters, genres, onRemoveGenre, onRemoveYearRange, onClearAll }: Props) {
  const activeGenres = genres.filter(g => filters.genres.includes(g.id))
  const hasYear = filters.yearRange !== null
  const count = activeGenres.length + (hasYear ? 1 : 0)

  if (count === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
      {activeGenres.map(g => (
        <button
          key={g.id}
          onClick={() => onRemoveGenre(g.id)}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium"
        >
          {g.name}
          <span className="text-[10px] opacity-70">✕</span>
        </button>
      ))}
      {hasYear && (
        <button
          onClick={onRemoveYearRange}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-medium"
        >
          {filters.yearRange![0]}–{filters.yearRange![1]}
          <span className="text-[10px] opacity-70">✕</span>
        </button>
      )}
      {count > 1 && (
        <button
          onClick={onClearAll}
          className="flex-shrink-0 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
        >
          Tout effacer
        </button>
      )}
    </div>
  )
}
