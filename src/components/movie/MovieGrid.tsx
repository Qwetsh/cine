import { MovieCard } from './MovieCard'
import type { TmdbMovie } from '../../lib/tmdb'

interface MovieGridProps {
  movies: TmdbMovie[]
  onMovieClick?: (movie: TmdbMovie) => void
  loading?: boolean
}

export function MovieGrid({ movies, onMovieClick, loading = false }: MovieGridProps) {
  if (loading && movies.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-3 p-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[2/3] bg-[var(--color-surface-2)] rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!loading && movies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
        <span className="text-4xl mb-3">🎬</span>
        <p>Aucun film trouvé</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {movies.map(movie => (
        <MovieCard
          key={movie.id}
          movie={movie}
          onClick={() => onMovieClick?.(movie)}
        />
      ))}
    </div>
  )
}
