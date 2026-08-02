import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdb } from '../lib/tmdb'
import { getPosterUrl } from '../lib/tmdb'
import { MovieGrid } from '../components/movie/MovieGrid'
import { HoldablePoster } from '../components/hold/HoldablePoster'
import { useSettings } from '../hooks/useSettings'
import { useGenres } from '../hooks/useGenres'
import { useCollection } from '../hooks/useCollection'
import { useWatchlist } from '../hooks/useWatchlist'
import { useTvCollection } from '../hooks/useTvCollection'
import { useTvWatchlist } from '../hooks/useTvWatchlist'
import { useTvPersonalCollection } from '../hooks/useTvPersonalCollection'
import { useRecommendations } from '../hooks/useRecommendations'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useFriendsContext } from '../contexts/FriendsContext'
import { useAuth } from '../contexts/AuthContext'
import { detailPath, mergeByPopularity, tvShowToPosterMovie } from '../lib/media'
import type { MediaItem } from '../lib/media'
import { Avatar } from '../components/ui/Avatar'
import { supabase } from '../lib/supabase'
import type { TmdbMovie } from '../lib/tmdb'
import type { Profile } from '../types'

export function HomePage() {
  const { settings } = useSettings()
  const isForYou = settings.homeMode === 'forYou'
  const includeSeries = !settings.hideSeries

  const [trending, setTrending] = useState<MediaItem[]>([])
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
  const tvCollection = useTvCollection(includeSeries && isForYou ? coupleId : null)
  const tvWatchlist = useTvWatchlist(includeSeries && isForYou ? coupleId : null)
  const tvPersonal = useTvPersonalCollection(includeSeries && isForYou ? user?.id ?? null : null)

  // Le profil de goûts et les exclusions intègrent aussi les séries
  const unifiedCollection = useMemo(() => [
    ...collection.map(e => ({ ...e, media_type: 'movie' as const })),
    ...tvCollection.entries.map(e => ({
      id: e.id,
      watched_at: e.watched_at ?? e.created_at,
      rating_user1: e.rating_user1,
      rating_user2: e.rating_user2,
      note_user1: e.note_user1,
      note_user2: e.note_user2,
      emoji_user1: e.emoji_user1,
      emoji_user2: e.emoji_user2,
      movie: tvShowToPosterMovie(e.tv_show),
      media_type: 'tv' as const,
    })),
  ], [collection, tvCollection.entries])

  const unifiedWatchlist = useMemo(() => [
    ...watchlist.map(e => ({ ...e, media_type: 'movie' as const })),
    ...tvWatchlist.entries.map(e => ({
      id: e.id,
      added_by: e.added_by,
      note: e.note,
      created_at: e.created_at,
      movie: tvShowToPosterMovie(e.tv_show),
      media_type: 'tv' as const,
    })),
  ], [watchlist, tvWatchlist.entries])

  const unifiedPersonal = useMemo(() => [
    ...personalCollection.map(e => ({ ...e, media_type: 'movie' as const })),
    ...tvPersonal.entries.map(e => ({
      id: e.id,
      watched_at: e.watched_at,
      rating: e.rating,
      note: e.note,
      emoji: e.emoji,
      movie: tvShowToPosterMovie(e.tv_show),
      media_type: 'tv' as const,
    })),
  ], [personalCollection, tvPersonal.entries])

  const { results: recommended, loading: loadingReco, refresh: refreshReco } = useRecommendations(
    unifiedCollection, unifiedWatchlist, genres, isForYou, unifiedPersonal,
    includeSeries,
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

    // Only fetch trending if in trending mode — mixte films + séries
    if (!isForYou) {
      Promise.all([
        tmdb.getTrending('week'),
        includeSeries ? tmdb.getTrendingTv('week') : Promise.resolve({ results: [] }),
      ])
        .then(([movies, shows]) => {
          setTrending(mergeByPopularity(movies.results, shows.results).slice(0, 12))
        })
        .catch(console.error)
        .finally(() => setLoadingTrending(false))
    } else {
      setLoadingTrending(false)
    }
  }, [isForYou, includeSeries])

  // Friend recos widget
  const { recos } = useFriendsContext()
  const [friendRecos, setFriendRecos] = useState<Array<{
    id: string
    title: string
    posterPath: string | null
    tmdbId: number
    mediaType: 'movie' | 'tv'
    fromName: string
    fromUserId: string
  }>>([])

  useEffect(() => {
    // Pendant un rechargement des recos, garder l'affichage courant
    // plutôt que de vider le carrousel (évite le clignotement)
    if (recos.loading) return
    if (recos.received.length === 0) {
      setFriendRecos([])
      return
    }

    let cancelled = false
    const recent = recos.received.slice(0, 8)

    async function resolve() {
      const userIds = [...new Set(recent.map(r => r.from_user_id))]
      const profileMap = new Map<string, Profile>()
      if (userIds.length > 0) {
        const { data } = await supabase.from('profiles').select('*').in('id', userIds)
        for (const p of (data ?? []) as unknown as Profile[]) profileMap.set(p.id, p)
      }

      const results = await Promise.all(recent.map(async (r) => {
        const fromName = profileMap.get(r.from_user_id)?.display_name ?? 'Un ami'
        if (r.movie_id) {
          try {
            const m = await tmdb.getMovie(r.movie_id)
            return { id: r.id, title: m.title, posterPath: m.poster_path, tmdbId: r.movie_id, mediaType: 'movie' as const, fromName, fromUserId: r.from_user_id }
          } catch { return null }
        } else if (r.tv_show_id) {
          try {
            const s = await tmdb.getTvShow(r.tv_show_id)
            return { id: r.id, title: s.name, posterPath: s.poster_path, tmdbId: r.tv_show_id, mediaType: 'tv' as const, fromName, fromUserId: r.from_user_id }
          } catch { return null }
        }
        return null
      }))

      // Une résolution plus lente lancée pour un état antérieur ne doit pas
      // écraser celle du dernier état des recos
      if (cancelled) return
      setFriendRecos(results.filter((r): r is NonNullable<typeof r> => r !== null))
    }

    resolve()
    return () => { cancelled = true }
  }, [recos.received, recos.loading])

  const hasData = unifiedCollection.length > 0 || unifiedWatchlist.length > 0

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

      {/* Soirée Ciné card */}
      <div className="px-4 mb-4">
        <button
          onClick={() => navigate('/pick')}
          className="w-full bg-gradient-to-r from-[var(--color-accent)] to-purple-600 hover:from-[var(--color-accent-hover)] hover:to-purple-700 text-white rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-base">Soirée Ciné</p>
              <p className="text-white/80 text-xs mt-0.5">Choisir un film ou lancer un quiz</p>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
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
              <HoldablePoster key={movie.id} movie={movie} className="flex-shrink-0" radius={12}>
              <button
                onClick={() => navigate(`/movie/${movie.id}`)}
                className="w-28 text-left group"
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
              </HoldablePoster>
            ))}
          </div>
        )}
      </div>

      {/* Recos de tes amis — horizontal scroll */}
      {settings.showFriendRecos && friendRecos.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="font-bold text-[var(--color-text)]">Recos de tes amis</h2>
            <button
              onClick={() => navigate('/social')}
              className="text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              Tout voir
            </button>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide pb-1">
            {friendRecos.map(reco => (
              <HoldablePoster
                key={reco.id}
                movie={{
                  id: reco.tmdbId,
                  title: reco.title,
                  original_title: reco.title,
                  overview: '',
                  poster_path: reco.posterPath,
                  backdrop_path: null,
                  release_date: '',
                  vote_average: 0,
                  vote_count: 0,
                  genre_ids: [],
                  popularity: 0,
                  adult: false,
                  media_type: reco.mediaType,
                } as TmdbMovie}
                partial
                className="flex-shrink-0"
                radius={12}
              >
              <button
                onClick={() => navigate(reco.mediaType === 'movie' ? `/movie/${reco.tmdbId}` : `/tv/${reco.tmdbId}`)}
                className="w-28 text-left group"
              >
                <div className="relative w-28 aspect-[2/3] rounded-xl overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-colors">
                  {reco.posterPath ? (
                    <img
                      src={getPosterUrl(reco.posterPath, 'small')}
                      alt={reco.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <Avatar name={reco.fromName} id={reco.fromUserId} size="xs" />
                      <span className="text-[10px] text-white/90 font-medium truncate">
                        {reco.fromName}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text)] mt-1.5 line-clamp-2 leading-tight">
                  {reco.title}
                </p>
              </button>
              </HoldablePoster>
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
            onMovieClick={movie => navigate(detailPath(movie))}
          />
        )}

        {!isForYou && (
          <MovieGrid
            movies={trending}
            loading={loadingTrending}
            onMovieClick={movie => navigate(detailPath(movie))}
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
