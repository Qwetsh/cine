import { useEffect } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../../lib/tmdb'
import { TrailerButton } from '../movie/TrailerButton'

interface Props {
  movie: TmdbMovie
  genres: TmdbGenre[]
  open: boolean
  onClose: () => void
}

export function MovieDetailSheet({ movie, genres, open, onClose }: Props) {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const movieGenres = genres.filter(g => movie.genre_ids?.includes(g.id))

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-[var(--color-surface)] rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 sticky top-0 bg-[var(--color-surface)] z-10">
          <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Content */}
        <div className="px-4 pb-6">
          {/* Header: poster + info */}
          <div className="flex gap-4">
            <div className="w-24 flex-shrink-0 rounded-xl overflow-hidden shadow-lg">
              <img
                src={getPosterUrl(movie.poster_path, 'medium')}
                alt={movie.title}
                className="w-full"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg text-[var(--color-text)] leading-tight">
                {movie.title}
              </h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[var(--color-text-muted)]">
                {year && <span>{year}</span>}
                {movie.vote_average > 0 && (
                  <span className="text-[var(--color-gold)]">
                    ★ {movie.vote_average.toFixed(1)}
                  </span>
                )}
                <TrailerButton tmdbId={movie.id} mediaType="movie" />
              </div>
              {movieGenres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {movieGenres.map(g => (
                    <span
                      key={g.id}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Synopsis */}
          {movie.overview && (
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mt-4">
              {movie.overview}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
