import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFriendsContext } from '../contexts/FriendsContext'
import { useFriendCollection } from '../hooks/useFriendCollection'
import { useFriendAffinity } from '../hooks/useFriendAffinity'
import { useSettings } from '../hooks/useSettings'
import { getPosterUrl } from '../lib/tmdb'
import type { TmdbMovie } from '../lib/tmdb'
import { detailPath, tvShowToPosterMovie } from '../lib/media'
import { StarRating } from '../components/movie/StarRating'
import { HoldablePoster } from '../components/hold/HoldablePoster'
import { posterMovieFromDb } from '../lib/movies'
import { Avatar } from '../components/ui/Avatar'
import type { UnifiedPersonalCollectionEntry } from '../types'

type SortKey = 'date' | 'rating' | 'title'

export function FriendProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { friends } = useFriendsContext()
  const { settings } = useSettings()
  const { movies, tvShows, loading } = useFriendCollection(userId ?? null)
  const { affinity } = useFriendAffinity(userId ?? null)

  const [sort, setSort] = useState<SortKey>('date')
  const showSeries = !settings.hideSeries

  const friend = friends.find(f => f.profile.id === userId)

  // Hors liste d'amis (ex. partenaire), le profil reste lisible via RLS :
  // résoudre le vrai nom plutôt qu'afficher « Ami »
  const [resolvedName, setResolvedName] = useState<string | null>(null)
  useEffect(() => {
    if (!userId || friend) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.display_name) setResolvedName(data.display_name)
      })
    return () => { cancelled = true }
  }, [userId, friend])

  const friendName = friend?.profile.display_name ?? resolvedName ?? 'Ami'

  // Liste unifiée films + séries, tri commun
  const unified: UnifiedPersonalCollectionEntry[] = useMemo(() => {
    const films: UnifiedPersonalCollectionEntry[] = movies.map(e => ({ ...e, media_type: 'movie' as const }))
    const series: UnifiedPersonalCollectionEntry[] = showSeries
      ? tvShows.map(e => ({
          id: e.id,
          watched_at: e.watched_at,
          rating: e.rating,
          note: e.note,
          emoji: e.emoji ?? null,
          movie: tvShowToPosterMovie(e.tv_show),
          media_type: 'tv' as const,
          number_of_seasons: e.tv_show.number_of_seasons,
        }))
      : []
    return [...films, ...series]
  }, [movies, tvShows, showSeries])

  const sortedEntries = useMemo(() => [...unified].sort((a, b) => {
    if (sort === 'date') return b.watched_at.localeCompare(a.watched_at)
    if (sort === 'title') return a.movie.title.localeCompare(b.movie.title)
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return 0
  }), [unified, sort])

  const totalCount = unified.length

  const affinityCommon = (affinity?.common ?? []).filter(
    item => showSeries || item.media_type !== 'tv'
  )

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-3"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Retour
        </button>
        <div className="flex items-center gap-3">
          <Avatar name={friendName} id={userId} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[var(--color-text)]">{friendName}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Collection personnelle
            </p>
          </div>
          <button
            onClick={() => navigate(`/pick?challenge=${userId}`)}
            className="flex-shrink-0 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-medium px-3 py-2 rounded-xl transition-colors"
          >
            ⚔️ Défier
          </button>
        </div>
      </div>

      {/* Affinité */}
      {affinity && affinity.common_count > 0 && (
        <div className="mx-4 mt-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4">
          <div className="flex items-center gap-4">
            {affinity.affinity_pct != null && (
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-[var(--color-accent)]/10 border-2 border-[var(--color-accent)] flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-[var(--color-accent)]">{affinity.affinity_pct}%</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              {affinity.affinity_pct != null && (
                <p className="text-sm font-medium text-[var(--color-text)]">Affinité ciné</p>
              )}
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {affinity.common_count} titre{affinity.common_count > 1 ? 's' : ''} en commun
                {affinity.rated_common_count > 0 && ` · ${affinity.rated_common_count} noté${affinity.rated_common_count > 1 ? 's' : ''} par vous deux`}
              </p>
            </div>
          </div>

          {/* Titres en commun */}
          <div className="flex gap-3 mt-3 overflow-x-auto pb-1 -mx-1 px-1">
            {affinityCommon.slice(0, 12).map(item => (
              <HoldablePoster
                key={`${item.media_type}-${item.tmdb_id}`}
                movie={{
                  id: item.tmdb_id,
                  title: item.title,
                  original_title: item.title,
                  overview: '',
                  poster_path: item.poster_path,
                  backdrop_path: null,
                  release_date: '',
                  vote_average: 0,
                  vote_count: 0,
                  genre_ids: [],
                  popularity: 0,
                  adult: false,
                  media_type: item.media_type,
                } as TmdbMovie}
                partial
                className="flex-shrink-0"
              >
              <button
                onClick={() => navigate(item.media_type === 'movie' ? `/movie/${item.tmdb_id}` : `/tv/${item.tmdb_id}`)}
                className="w-16 text-left"
              >
                <img
                  src={getPosterUrl(item.poster_path, 'small')}
                  alt={item.title}
                  className="w-16 h-24 rounded-lg object-cover bg-[var(--color-surface-2)]"
                  loading="lazy"
                />
                <div className="mt-1 text-[10px] leading-tight text-[var(--color-text-muted)]">
                  {item.my_rating != null && <span>Toi ★{item.my_rating}</span>}
                  {item.my_rating != null && item.friend_rating != null && <span> · </span>}
                  {item.friend_rating != null && <span>{friendName.split(' ')[0]} ★{item.friend_rating}</span>}
                </div>
              </button>
              </HoldablePoster>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && (
        <div className="px-4 py-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            {totalCount} titre{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Sort */}
      <div className="flex gap-2 px-4 mb-4">
        {(['date', 'rating', 'title'] as SortKey[]).map(key => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              sort === key
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]',
            ].join(' ')}
          >
            {key === 'date' ? 'Date' : key === 'rating' ? 'Note' : 'Titre'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="px-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-[var(--color-surface)] rounded-xl animate-pulse border border-[var(--color-border)]" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">🎬</span>
          <p className="text-[var(--color-text-muted)]">
            {friendName} n'a pas encore de titres dans sa collection
          </p>
        </div>
      ) : (
        <ul className="px-4 space-y-3 pb-8">
          {sortedEntries.map(entry => (
            <CollectionEntry key={`${entry.media_type}-${entry.id}`} entry={entry} navigate={navigate} />
          ))}
        </ul>
      )}
    </div>
  )
}

function CollectionEntry({ entry, navigate }: { entry: UnifiedPersonalCollectionEntry; navigate: (path: string) => void }) {
  const isTv = entry.media_type === 'tv'
  const path = detailPath({ id: entry.movie.tmdb_id, media_type: entry.media_type })
  return (
    <li className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="flex gap-3 p-3">
        <HoldablePoster
          movie={{ ...posterMovieFromDb(entry.movie), media_type: entry.media_type }}
          movieDbId={entry.movie.id}
          className="flex-shrink-0"
        >
        <button
          onClick={() => navigate(path)}
          className="relative w-14 h-20 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
        >
          <img
            src={getPosterUrl(entry.movie.poster_path, 'small')}
            alt={entry.movie.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {isTv && (
            <div className="absolute top-1 right-1 bg-purple-600/90 text-white text-[7px] font-bold px-1 py-0.5 rounded">
              Série
            </div>
          )}
        </button>
        </HoldablePoster>
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate(path)} className="text-left">
            <p className="font-semibold text-[var(--color-text)] text-sm hover:text-[var(--color-accent)] transition-colors">
              {entry.movie.title}
            </p>
          </button>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            Vu le {new Date(entry.watched_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {isTv && entry.number_of_seasons
              ? ` · ${entry.number_of_seasons} saison${entry.number_of_seasons > 1 ? 's' : ''}`
              : ''}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {entry.emoji && <span className="text-base">{entry.emoji}</span>}
            {entry.rating != null && <StarRating value={entry.rating} readOnly size="sm" />}
          </div>
          {entry.note && (
            <p className="text-xs text-[var(--color-text-muted)] italic mt-1 line-clamp-2">
              « {entry.note} »
            </p>
          )}
        </div>
      </div>
    </li>
  )
}
