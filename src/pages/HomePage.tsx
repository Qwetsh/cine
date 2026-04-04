import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdb } from '../lib/tmdb'
import { MovieGrid } from '../components/movie/MovieGrid'
import type { TmdbMovie } from '../lib/tmdb'

export function HomePage() {
  const [trending, setTrending] = useState<TmdbMovie[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    tmdb.getTrending('week')
      .then(data => setTrending(data.results.slice(0, 9)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
          Bonsoir 🎬
        </h1>
        <p className="text-[var(--color-text-muted)] text-sm">
          Que regardez-vous ce soir ?
        </p>
      </div>

      {/* Raccourcis */}
      <div className="flex gap-3 px-4 mb-6">
        <button
          onClick={() => navigate('/watchlist')}
          className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl p-4 text-left transition-colors"
        >
          <div className="text-2xl mb-2">📋</div>
          <div className="font-semibold text-sm">À regarder</div>
          <div className="text-xs text-white/70 mt-1">Votre liste commune</div>
        </button>
        <button
          onClick={() => navigate('/collection')}
          className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] rounded-xl p-4 text-left transition-colors border border-[var(--color-border)]"
        >
          <div className="text-2xl mb-2">⭐</div>
          <div className="font-semibold text-sm text-[var(--color-text)]">Collection</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">Films déjà vus</div>
        </button>
      </div>

      {/* Tendances */}
      <div>
        <div className="flex items-center justify-between px-4 mb-3">
          <h2 className="font-bold text-[var(--color-text)]">Tendances cette semaine</h2>
          <button
            onClick={() => navigate('/search')}
            className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            Voir plus →
          </button>
        </div>
        <MovieGrid
          movies={trending}
          loading={loading}
          onMovieClick={movie => navigate(`/movie/${movie.id}`)}
        />
      </div>
    </div>
  )
}
