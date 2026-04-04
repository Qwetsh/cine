import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie } from '../../lib/tmdb'

interface MovieCardProps {
  movie: TmdbMovie
  onClick?: () => void
  compact?: boolean
}

export function MovieCard({ movie, onClick, compact = false }: MovieCardProps) {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const rating = movie.vote_average ? movie.vote_average.toFixed(1) : null

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex gap-3 w-full text-left hover:bg-[var(--color-surface-2)] rounded-lg p-2 transition-colors"
      >
        <div className="w-12 h-18 flex-shrink-0 rounded overflow-hidden bg-[var(--color-surface-2)]">
          <img
            src={getPosterUrl(movie.poster_path, 'small')}
            alt={`Affiche de ${movie.title}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex-1 min-w-0 py-1">
          <p className="font-medium text-[var(--color-text)] text-sm truncate">{movie.title}</p>
          {year && <p className="text-[var(--color-text-muted)] text-xs">{year}</p>}
          {rating && (
            <p className="text-[var(--color-gold)] text-xs mt-1">★ {rating}</p>
          )}
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left rounded-lg overflow-hidden bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors"
    >
      {/* Affiche */}
      <div className="relative aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
        <img
          src={getPosterUrl(movie.poster_path, 'medium')}
          alt={`Affiche de ${movie.title}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {rating && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-[var(--color-gold)] text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            ★ {rating}
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="p-2">
        <p className="font-medium text-[var(--color-text)] text-sm leading-tight line-clamp-2">
          {movie.title}
        </p>
        {year && (
          <p className="text-[var(--color-text-muted)] text-xs mt-1">{year}</p>
        )}
      </div>
    </button>
  )
}
