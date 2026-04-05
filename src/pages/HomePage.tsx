import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdb } from '../lib/tmdb'
import { getPosterUrl } from '../lib/tmdb'
import { MovieGrid } from '../components/movie/MovieGrid'
import type { TmdbMovie } from '../lib/tmdb'

export function HomePage() {
  const [trending, setTrending] = useState<TmdbMovie[]>([])
  const [upcoming, setUpcoming] = useState<TmdbMovie[]>([])
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    tmdb.getTrending('week')
      .then(data => setTrending(data.results.slice(0, 9)))
      .catch(console.error)
      .finally(() => setLoadingTrending(false))

    // Fetch 2 pages to get enough results
    Promise.all([tmdb.getUpcoming(1), tmdb.getUpcoming(2)])
      .then(([p1, p2]) => {
        const all = [...p1.results, ...p2.results]
        // Keep movies with poster, sorted by release date
        const filtered = all
          .filter(m => m.poster_path && m.release_date)
          .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
          // Deduplicate by id
          .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
          .slice(0, 15)
        setUpcoming(filtered)
      })
      .catch(console.error)
      .finally(() => setLoadingUpcoming(false))
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

      {/* Prochaines sorties — horizontal scroll */}
      <div className="mb-6">
        <div className="flex items-center justify-between px-4 mb-3">
          <h2 className="font-bold text-[var(--color-text)]">Prochaines sorties</h2>
        </div>
        {loadingUpcoming ? (
          <div className="flex gap-3 px-4 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-28">
                <div className="w-28 h-42 rounded-xl bg-[var(--color-surface)] animate-pulse aspect-[2/3]" />
                <div className="h-3 bg-[var(--color-surface)] rounded mt-2 w-20 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1">
            {upcoming.map(movie => (
              <button
                key={movie.id}
                onClick={() => navigate(`/movie/${movie.id}`)}
                className="flex-shrink-0 w-28 text-left group"
              >
                <div className="relative w-28 aspect-[2/3] rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-colors">
                  {movie.poster_path ? (
                    <img
                      src={getPosterUrl(movie.poster_path, 'small')}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                  )}
                  {/* Release date badge */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                    <span className="text-[10px] text-white/90 font-medium">
                      {formatReleaseDate(movie.release_date)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text)] mt-1.5 line-clamp-2 leading-tight">
                  {movie.title}
                </p>
              </button>
            ))}
          </div>
        )}
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
          loading={loadingTrending}
          onMovieClick={movie => navigate(`/movie/${movie.id}`)}
        />
      </div>
    </div>
  )
}

function formatReleaseDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'En salle'
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Demain'
  if (diffDays <= 7) return `Dans ${diffDays}j`

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
