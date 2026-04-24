import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { useCollection } from '../hooks/useCollection'
import { useTvWatchlist } from '../hooks/useTvWatchlist'
import { useTvCollection } from '../hooks/useTvCollection'
import { useLocalFilter } from '../hooks/useLocalFilter'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useSettings } from '../hooks/useSettings'
import { getPosterUrl } from '../lib/tmdb'
import { CollectionFilterPanel } from '../components/filters/CollectionFilterPanel'
import { useFriendsContext } from '../contexts/FriendsContext'
import { MarkWatchedModal, type MarkWatchedData } from '../components/movie/MarkWatchedModal'
import type { WatchlistMovieEntry, TvWatchlistEntry } from '../types'

export function WatchlistPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const { settings } = useSettings()
  const { recos } = useFriendsContext()
  const { entries, loading, removeFromWatchlist } = useWatchlist(coupleId, user?.id)
  // Watchlist solo perso — utile uniquement quand on a un couple (sinon entries = solo)
  const soloWl = useWatchlist(null, coupleId ? user?.id : null)
  const { addToCollection } = useCollection(coupleId)
  const { addToPersonalCollection } = usePersonalCollection(user?.id ?? null)
  const tvWatchlist = useTvWatchlist(settings.showSeries ? coupleId : null, settings.showSeries ? user?.id : null)
  const tvCollection = useTvCollection(settings.showSeries ? coupleId : null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'couple' | 'solo'>(coupleId ? 'couple' : 'solo')
  const [modalEntry, setModalEntry] = useState<WatchlistMovieEntry | null>(null)

  const activeEntries = coupleId && viewMode === 'solo' ? soloWl.entries : entries

  const {
    filters, filtered, availableGenres, activeCount,
    setQuery, toggleGenre, setYearRange, clearAll,
  } = useLocalFilter(activeEntries)

  function handleMarkWatched(entry: WatchlistMovieEntry) {
    setModalEntry(entry)
  }

  async function handleModalConfirm(data: MarkWatchedData) {
    const entry = modalEntry
    if (!entry) return
    setModalEntry(null)
    setActionId(entry.id)

    const isSolo = !coupleId || viewMode === 'solo'

    if (isSolo) {
      await addToPersonalCollection(entry.movie.id, {
        rating: data.myRating,
        note: data.myNote || null,
        emoji: data.myEmoji,
      })
      if (coupleId) {
        await soloWl.removeFromWatchlist(entry.id)
      } else {
        await removeFromWatchlist(entry.id)
      }
    } else {
      const extras = isUser1
        ? {
            rating_user1: data.myRating,
            note_user1: data.myNote || null,
            emoji_user1: data.myEmoji,
            rating_user2: data.partnerRating,
            note_user2: null as string | null,
            emoji_user2: data.partnerEmoji,
          }
        : {
            rating_user2: data.myRating,
            note_user2: data.myNote || null,
            emoji_user2: data.myEmoji,
            rating_user1: data.partnerRating,
            note_user1: null as string | null,
            emoji_user1: data.partnerEmoji,
          }
      const { error } = await addToCollection(entry.movie.id, extras)
      if (!error) await removeFromWatchlist(entry.id)
    }

    setActionId(null)
  }

  async function handleRemove(entryId: string) {
    setActionId(entryId)
    if (coupleId && viewMode === 'solo') {
      await soloWl.removeFromWatchlist(entryId)
    } else {
      await removeFromWatchlist(entryId)
    }
    setActionId(null)
  }

  async function handleTvMarkWatched(entry: TvWatchlistEntry) {
    setActionId(entry.id)
    await tvCollection.addToTvCollection(entry.tv_show.id)
    await tvWatchlist.removeFromTvWatchlist(entry.id)
    setActionId(null)
  }

  async function handleTvRemove(entryId: string) {
    setActionId(entryId)
    await tvWatchlist.removeFromTvWatchlist(entryId)
    setActionId(null)
  }


  function getAddedByLabel(addedBy: string) {
    if (addedBy === user?.id) return 'Toi'
    return partner?.display_name ?? 'Partenaire'
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">À regarder</h1>
        {!loading && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {activeEntries.length + (viewMode === 'couple' ? tvWatchlist.entries.length : 0)} élément{(activeEntries.length + (viewMode === 'couple' ? tvWatchlist.entries.length : 0)) !== 1 ? 's' : ''}
            {activeCount > 0 && ` · ${filtered.length} affiché${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Toggle couple / solo / recos */}
      {coupleId ? (
        <div className="px-4 mb-3">
          <div className="flex rounded-xl bg-[var(--color-surface-2)] p-1">
            <button
              onClick={() => setViewMode('couple')}
              className={[
                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                viewMode === 'couple'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              👫 En couple
            </button>
            <button
              onClick={() => setViewMode('solo')}
              className={[
                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                viewMode === 'solo'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              🎬 Perso {soloWl.entries.length > 0 && `(${soloWl.entries.length})`}
            </button>
            <button
              onClick={() => navigate('/recommendations')}
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center justify-center gap-1"
            >
              💌 Recos
              {recos.unseenCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                  {recos.unseenCount}
                </span>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 mb-3">
          <button
            onClick={() => navigate('/recommendations')}
            className="w-full flex items-center justify-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            💌 Recos de mes amis
            {recos.unseenCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                {recos.unseenCount}
              </span>
            )}
          </button>
        </div>
      )}

      <div className="px-4 mb-3">
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          + Ajouter {settings.showSeries ? 'un film ou une série' : 'un film'}
        </button>
      </div>

      {/* Filter accordion */}
      {!loading && activeEntries.length > 0 && (
        <CollectionFilterPanel
          filters={filters}
          availableGenres={availableGenres}
          activeCount={activeCount}
          onQueryChange={setQuery}
          onToggleGenre={toggleGenre}
          onYearRangeChange={setYearRange}
          onClearAll={clearAll}
        />
      )}

      {loading ? (
        <ul className="px-4 space-y-3">
          {[1, 2, 3].map(i => (
            <li key={i} className="bg-[var(--color-surface)] rounded-xl h-28 animate-pulse border border-[var(--color-border)]" />
          ))}
        </ul>
      ) : activeEntries.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
          <span className="text-5xl mb-4">📋</span>
          <p className="font-medium">Votre liste est vide</p>
          <p className="text-sm mt-1">Ajoutez des films que vous voulez voir</p>
          <button
            onClick={() => navigate('/search')}
            className="mt-4 bg-[var(--color-accent)] text-white px-6 py-2 rounded-xl text-sm"
          >
            Parcourir les films
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
          <p className="text-sm">Aucun film ne correspond aux filtres</p>
          <button onClick={clearAll} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
            Effacer les filtres
          </button>
        </div>
      ) : (
        <ul className="px-4 space-y-3 pb-4">
          {filtered.map(entry => (
            <li
              key={entry.id}
              className="bg-[var(--color-surface)] rounded-xl overflow-hidden border border-[var(--color-border)]"
            >
              <div className="flex gap-3 p-3">
                <button
                  onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)}
                  className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                >
                  <img
                    src={getPosterUrl(entry.movie.poster_path, 'small')}
                    alt={`Affiche ${entry.movie.title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)}
                    className="text-left"
                  >
                    <p className="font-semibold text-[var(--color-text)] leading-tight hover:text-[var(--color-accent)] transition-colors">
                      {entry.movie.title}
                    </p>
                  </button>
                  <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                    {entry.movie.release_date && new Date(entry.movie.release_date).getFullYear()}
                    {entry.movie.release_date && entry.movie.runtime ? ' · ' : ''}
                    {entry.movie.runtime && `${Math.floor(entry.movie.runtime / 60)}h${(entry.movie.runtime % 60).toString().padStart(2, '0')}`}
                  </p>
                  {coupleId && (
                    <p className="text-[var(--color-text-muted)] text-xs mt-2">
                      Ajouté par{' '}
                      <span className="text-[var(--color-text)]">
                        {getAddedByLabel(entry.added_by)}
                      </span>
                    </p>
                  )}
                  {entry.note && (
                    <p className="text-[var(--color-text-muted)] text-xs mt-1 italic">
                      "{entry.note}"
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 justify-start pt-1">
                  <button
                    onClick={() => handleMarkWatched(entry)}
                    disabled={actionId === entry.id}
                    className="text-[var(--color-text-muted)] hover:text-green-400 text-xl transition-colors disabled:opacity-40"
                    title="On l'a vu !"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleRemove(entry.id)}
                    disabled={actionId === entry.id}
                    className="text-[var(--color-text-muted)] hover:text-red-400 text-xl transition-colors disabled:opacity-40"
                    title="Retirer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}

          {/* TV watchlist entries — couple mode only */}
          {viewMode !== 'solo' && tvWatchlist.entries.map(entry => (
            <li
              key={`tv-${entry.id}`}
              className="bg-[var(--color-surface)] rounded-xl overflow-hidden border border-[var(--color-border)]"
            >
              <div className="flex gap-3 p-3">
                <button
                  onClick={() => navigate(`/tv/${entry.tv_show.tmdb_id}`)}
                  className="relative w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                >
                  <img
                    src={getPosterUrl(entry.tv_show.poster_path, 'small')}
                    alt={`Affiche ${entry.tv_show.name}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-1 right-1 bg-purple-600/90 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                    Série
                  </div>
                </button>

                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/tv/${entry.tv_show.tmdb_id}`)}
                    className="text-left"
                  >
                    <p className="font-semibold text-[var(--color-text)] leading-tight hover:text-[var(--color-accent)] transition-colors">
                      {entry.tv_show.name}
                    </p>
                  </button>
                  <p className="text-purple-400 text-xs mt-0.5 font-medium">
                    Saison {entry.season_number}
                  </p>
                  {coupleId && (
                    <p className="text-[var(--color-text-muted)] text-xs mt-2">
                      Ajouté par{' '}
                      <span className="text-[var(--color-text)]">
                        {getAddedByLabel(entry.added_by)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 justify-start pt-1">
                  <button
                    onClick={() => handleTvMarkWatched(entry)}
                    disabled={actionId === entry.id}
                    className="text-[var(--color-text-muted)] hover:text-green-400 text-xl transition-colors disabled:opacity-40"
                    title="On l'a vu !"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleTvRemove(entry.id)}
                    disabled={actionId === entry.id}
                    className="text-[var(--color-text-muted)] hover:text-red-400 text-xl transition-colors disabled:opacity-40"
                    title="Retirer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalEntry && (
        <MarkWatchedModal
          movie={modalEntry.movie}
          mode={coupleId && viewMode === 'couple' ? 'couple' : 'solo'}
          partnerName={partner?.display_name}
          onConfirm={handleModalConfirm}
          onClose={() => setModalEntry(null)}
        />
      )}
    </div>
  )
}
