import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFriendsContext } from '../contexts/FriendsContext'
import { useFriendCollection } from '../hooks/useFriendCollection'
import { useSettings } from '../hooks/useSettings'
import { getPosterUrl } from '../lib/tmdb'
import { StarRating } from '../components/movie/StarRating'
import { Avatar } from '../components/ui/Avatar'
import type { PersonalCollectionEntry, TvPersonalCollectionEntry } from '../types'

type MediaFilter = 'all' | 'film' | 'serie'
type SortKey = 'date' | 'rating' | 'title'

export function FriendProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { friends } = useFriendsContext()
  const { settings } = useSettings()
  const { movies, tvShows, loading } = useFriendCollection(userId ?? null)

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all')
  const [sort, setSort] = useState<SortKey>('date')

  const friend = friends.find(f => f.profile.id === userId)
  const friendName = friend?.profile.display_name ?? 'Ami'

  const showFilms = mediaFilter !== 'serie'
  const showSeries = settings.showSeries && mediaFilter !== 'film'

  const sortedMovies = [...movies].sort((a, b) => {
    if (sort === 'date') return b.watched_at.localeCompare(a.watched_at)
    if (sort === 'title') return a.movie.title.localeCompare(b.movie.title)
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return 0
  })

  const sortedTv = [...tvShows].sort((a, b) => {
    if (sort === 'date') return b.watched_at.localeCompare(a.watched_at)
    if (sort === 'title') return a.tv_show.name.localeCompare(b.tv_show.name)
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return 0
  })

  const totalCount = (showFilms ? movies.length : 0) + (showSeries ? tvShows.length : 0)

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
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">{friendName}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Collection personnelle
            </p>
          </div>
        </div>
      </div>

      {/* Media filter */}
      {settings.showSeries && (
        <div className="flex mx-4 mt-4 mb-2 rounded-xl bg-[var(--color-surface-2)] p-1">
          {(['all', 'film', 'serie'] as MediaFilter[]).map(key => (
            <button
              key={key}
              onClick={() => setMediaFilter(key)}
              className={[
                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                mediaFilter === key
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              {key === 'all' ? 'Tout' : key === 'film' ? 'Films' : 'Séries'}
            </button>
          ))}
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
            {friendName} n'a pas encore de films dans sa collection
          </p>
        </div>
      ) : (
        <ul className="px-4 space-y-3 pb-8">
          {/* TV shows */}
          {showSeries && sortedTv.map(entry => (
            <TvEntry key={`tv-${entry.id}`} entry={entry} navigate={navigate} />
          ))}

          {/* Movies */}
          {showFilms && sortedMovies.map(entry => (
            <MovieEntry key={entry.id} entry={entry} navigate={navigate} />
          ))}
        </ul>
      )}
    </div>
  )
}

function MovieEntry({ entry, navigate }: { entry: PersonalCollectionEntry; navigate: (path: string) => void }) {
  return (
    <li className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="flex gap-3 p-3">
        <button
          onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)}
          className="w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
        >
          <img
            src={getPosterUrl(entry.movie.poster_path, 'small')}
            alt={entry.movie.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)} className="text-left">
            <p className="font-semibold text-[var(--color-text)] text-sm hover:text-[var(--color-accent)] transition-colors">
              {entry.movie.title}
            </p>
          </button>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            Vu le {new Date(entry.watched_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
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

function TvEntry({ entry, navigate }: { entry: TvPersonalCollectionEntry; navigate: (path: string) => void }) {
  return (
    <li className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="flex gap-3 p-3">
        <button
          onClick={() => navigate(`/tv/${entry.tv_show.tmdb_id}`)}
          className="relative w-14 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
        >
          <img
            src={getPosterUrl(entry.tv_show.poster_path, 'small')}
            alt={entry.tv_show.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute top-1 right-1 bg-purple-600/90 text-white text-[7px] font-bold px-1 py-0.5 rounded">
            Série
          </div>
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate(`/tv/${entry.tv_show.tmdb_id}`)} className="text-left">
            <p className="font-semibold text-[var(--color-text)] text-sm hover:text-[var(--color-accent)] transition-colors">
              {entry.tv_show.name}
            </p>
          </button>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            {entry.tv_show.number_of_seasons} saison{(entry.tv_show.number_of_seasons ?? 0) > 1 ? 's' : ''}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
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
