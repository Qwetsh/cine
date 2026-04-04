import type { TmdbGenre } from '../../lib/tmdb'

interface Props {
  genres: TmdbGenre[]
  selected: number[]
  onToggle: (genreId: number) => void
}

export function GenreChips({ genres, selected, onToggle }: Props) {
  const allSelected = selected.length === 0

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      <button
        onClick={() => { if (!allSelected) selected.forEach(g => onToggle(g)) }}
        className={[
          'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
          allSelected
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        ].join(' ')}
      >
        Tous
      </button>
      {genres.map(g => {
        const active = selected.includes(g.id)
        return (
          <button
            key={g.id}
            onClick={() => onToggle(g.id)}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              active
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            {g.name}
          </button>
        )
      })}
    </div>
  )
}
