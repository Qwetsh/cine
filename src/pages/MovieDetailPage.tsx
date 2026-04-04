import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tmdb, getBackdropUrl, getPosterUrl } from '../lib/tmdb'
import type { TmdbMovieDetail } from '../lib/tmdb'

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [movie, setMovie] = useState<TmdbMovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    tmdb.getMovie(Number(id))
      .then(setMovie)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="aspect-video bg-[var(--color-surface-2)] animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-6 bg-[var(--color-surface-2)] rounded animate-pulse w-3/4" />
          <div className="h-4 bg-[var(--color-surface-2)] rounded animate-pulse w-1/4" />
          <div className="h-20 bg-[var(--color-surface-2)] rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
        <p>Film introuvable</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-[var(--color-accent)]">
          ← Retour
        </button>
      </div>
    )
  }

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const director = movie.credits?.crew.find(c => c.job === 'Director')
  const cast = movie.credits?.cast.slice(0, 5) ?? []
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h${(movie.runtime % 60).toString().padStart(2, '0')}`
    : null

  return (
    <div className="max-w-2xl mx-auto pb-6">
      {/* Backdrop */}
      <div className="relative">
        <div className="aspect-video bg-[var(--color-surface-2)] overflow-hidden">
          <img
            src={getBackdropUrl(movie.backdrop_path, 'large')}
            alt={`Backdrop ${movie.title}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-transparent to-transparent" />
        </div>

        {/* Bouton retour */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white rounded-full w-9 h-9 flex items-center justify-center"
        >
          ←
        </button>
      </div>

      {/* Contenu */}
      <div className="px-4 -mt-10 relative">
        <div className="flex gap-4">
          {/* Affiche */}
          <div className="w-24 flex-shrink-0 rounded-xl overflow-hidden shadow-xl">
            <img
              src={getPosterUrl(movie.poster_path, 'medium')}
              alt={`Affiche ${movie.title}`}
              className="w-full"
            />
          </div>

          {/* Titre + méta */}
          <div className="flex-1 min-w-0 pt-12">
            <h1 className="font-bold text-xl text-[var(--color-text)] leading-tight">
              {movie.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[var(--color-text-muted)]">
              {year && <span>{year}</span>}
              {runtime && <span>· {runtime}</span>}
              {movie.vote_average > 0 && (
                <span className="text-[var(--color-gold)]">
                  ★ {movie.vote_average.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Genres */}
        {movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {movie.genres.map(g => (
              <span
                key={g.id}
                className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Synopsis */}
        {movie.overview && (
          <div className="mt-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Synopsis</h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
              {movie.overview}
            </p>
          </div>
        )}

        {/* Réalisateur */}
        {director && (
          <p className="mt-4 text-sm text-[var(--color-text-muted)]">
            Réalisé par{' '}
            <span className="text-[var(--color-text)] font-medium">{director.name}</span>
          </p>
        )}

        {/* Casting */}
        {cast.length > 0 && (
          <div className="mt-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Avec</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {cast.map(a => a.name).join(', ')}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors">
            + À regarder
          </button>
          <button className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors">
            ✓ On l'a vu !
          </button>
        </div>
      </div>
    </div>
  )
}
