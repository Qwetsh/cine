import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../../lib/tmdb'
import type { FeedbackType } from '../../hooks/useSmartSuggestion'

interface Props {
  movie: TmdbMovie
  genres: TmdbGenre[]
  onFeedback: (type: FeedbackType, movie: TmdbMovie) => void
  onAccept: (movie: TmdbMovie) => void
}

export function SuggestionCard({ movie, genres, onFeedback, onAccept }: Props) {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const movieGenres = genres.filter(g => movie.genre_ids.includes(g.id))

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Poster + info */}
      <div className="flex gap-4 p-4">
        <div className="w-28 flex-shrink-0 rounded-xl overflow-hidden shadow-lg">
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
              <span className="text-[var(--color-gold)]">★ {movie.vote_average.toFixed(1)}</span>
            )}
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
          {movie.overview && (
            <p className="text-[var(--color-text-muted)] text-xs leading-relaxed mt-2 line-clamp-4">
              {movie.overview}
            </p>
          )}
        </div>
      </div>

      {/* Feedback buttons */}
      <div className="border-t border-[var(--color-border)] p-3 space-y-2">
        <button
          onClick={() => onAccept(movie)}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          On regarde ce soir !
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onFeedback('too_old', movie)}
            className="bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg py-2 text-xs font-medium transition-colors"
          >
            Trop vieux
          </button>
          <button
            onClick={() => onFeedback('too_recent', movie)}
            className="bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg py-2 text-xs font-medium transition-colors"
          >
            Trop récent
          </button>
          <button
            onClick={() => onFeedback('not_this_genre', movie)}
            className="bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg py-2 text-xs font-medium transition-colors"
          >
            Pas ce thème
          </button>
        </div>
        <button
          onClick={() => onFeedback('same_genre_diff_movie', movie)}
          className="w-full bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text-muted)] rounded-lg py-2 text-xs font-medium transition-colors"
        >
          Ce thème me plaît, mais pas ce film
        </button>
      </div>
    </div>
  )
}
