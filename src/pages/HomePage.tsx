import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdb } from '../lib/tmdb'
import { getPosterUrl } from '../lib/tmdb'
import { MovieGrid } from '../components/movie/MovieGrid'
import { useSettings } from '../hooks/useSettings'
import { useGenres } from '../hooks/useGenres'
import { useCollection } from '../hooks/useCollection'
import { useWatchlist } from '../hooks/useWatchlist'
import { useRecommendations, type RecommendationItem } from '../hooks/useRecommendations'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useAuth } from '../contexts/AuthContext'
import { TvProviderLogos } from '../components/movie/TvProviderLogos'
import type { TmdbMovie, TmdbTvShow } from '../lib/tmdb'

export function HomePage() {
  const { settings } = useSettings()
  const isForYou = settings.homeMode === 'forYou'

  const [trending, setTrending] = useState<TmdbMovie[]>([])
  const [trendingTv, setTrendingTv] = useState<TmdbTvShow[]>([])
  const [upcoming, setUpcoming] = useState<TmdbMovie[]>([])
  const [loadingTrending, setLoadingTrending] = useState(true)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const navigate = useNavigate()

  // For "Pour vous" mode
  const { user } = useAuth()
  const { coupleId } = useCoupleContext()
  const { genres } = useGenres()
  const { entries: collection } = useCollection(coupleId)
  const { entries: watchlist } = useWatchlist(coupleId)
  const { entries: personalCollection } = usePersonalCollection(user?.id ?? null)
  const { results: recommended, loading: loadingReco, refresh: refreshReco } = useRecommendations(
    collection, watchlist, genres, isForYou, personalCollection,
    settings.showSeries && settings.suggestSeries,
  )

  useEffect(() => {
    // Always fetch upcoming
    Promise.all([tmdb.getUpcoming(1), tmdb.getUpcoming(2)])
      .then(([p1, p2]) => {
        const all = [...p1.results, ...p2.results]
        const filtered = all
          .filter(m => m.poster_path && m.release_date)
          .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
          .filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
          .slice(0, 15)
        setUpcoming(filtered)
      })
      .catch(console.error)
      .finally(() => setLoadingUpcoming(false))

    // Only fetch trending if in trending mode
    if (!isForYou) {
      tmdb.getTrending('week')
        .then(data => setTrending(data.results.slice(0, 9)))
        .catch(console.error)
        .finally(() => setLoadingTrending(false))
    } else {
      setLoadingTrending(false)
    }

    // Fetch trending TV if series enabled
    if (settings.showSeries) {
      tmdb.getTrendingTv('week')
        .then(data => setTrendingTv(data.results.slice(0, 10)))
        .catch(console.error)
    }
  }, [isForYou, settings.showSeries])

  const hasData = collection.length > 0 || watchlist.length > 0

  return (
    <div className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-1">
          {getGreeting()} {user?.profile?.display_name ?? ''}
        </h1>
        <button
          onClick={() => navigate('/watchlist')}
          className="text-[var(--color-text-muted)] text-sm hover:text-[var(--color-accent)] transition-colors"
        >
          Que regardez-vous {getTimeOfDay()} ?
        </button>
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

      {/* Trending TV — horizontal scroll */}
      {settings.showSeries && trendingTv.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="font-bold text-[var(--color-text)]">Séries tendances</h2>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1">
            {trendingTv.map(show => (
              <button
                key={show.id}
                onClick={() => navigate(`/tv/${show.id}`)}
                className="flex-shrink-0 w-28 text-left group"
              >
                <div className="relative w-28 aspect-[2/3] rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-colors">
                  {show.poster_path ? (
                    <img
                      src={getPosterUrl(show.poster_path, 'small')}
                      alt={show.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">📺</div>
                  )}
                  <div className="absolute top-2 right-2 bg-purple-600/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                    Série
                  </div>
                  <div className="absolute bottom-1.5 left-1.5">
                    <TvProviderLogos tmdbId={show.id} overlay />
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text)] mt-1.5 line-clamp-2 leading-tight">
                  {show.name}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main section: Tendances OR Pour vous */}
      <div>
        <div className="flex items-center justify-between px-4 mb-3">
          <h2 className="font-bold text-[var(--color-text)]">
            {isForYou ? 'Pour vous' : 'Tendances cette semaine'}
          </h2>
          {isForYou ? (
            <button
              onClick={refreshReco}
              disabled={loadingReco}
              className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {loadingReco ? '...' : 'Rafraichir →'}
            </button>
          ) : (
            <button
              onClick={() => navigate('/search')}
              className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              Voir plus →
            </button>
          )}
        </div>

        {isForYou && !hasData && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Ajoutez des films a votre collection ou liste a voir pour obtenir des recommandations personnalisees.
            </p>
          </div>
        )}

        {isForYou && hasData && (
          <MovieGrid
            movies={recommended}
            loading={loadingReco}
            onMovieClick={movie => {
              const item = movie as RecommendationItem
              navigate(item.media_type === 'tv' ? `/tv/${movie.id}` : `/movie/${movie.id}`)
            }}
          />
        )}

        {!isForYou && (
          <MovieGrid
            movies={trending}
            loading={loadingTrending}
            onMovieClick={movie => navigate(`/movie/${movie.id}`)}
          />
        )}
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bonjour'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function getTimeOfDay(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'ce matin'
  if (hour < 18) return 'cet après-midi'
  return 'ce soir'
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
