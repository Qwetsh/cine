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
import type { WatchlistMovieEntry, TvWatchlistEntry } from '../types'

export function WatchlistPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, partner } = useCoupleContext()
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

  const {
    filters, filtered, availableGenres, activeCount,
    setQuery, toggleGenre, setYearRange, clearAll,
  } = useLocalFilter(entries)

  async function handleMarkWatched(entry: WatchlistMovieEntry) {
    setActionId(entry.id)
    const { error } = await addToCollection(entry.movie.id)
    if (!error) {
      await removeFromWatchlist(entry.id)
    }
    setActionId(null)
  }

  async function handleRemove(entryId: string) {
    setActionId(entryId)
    await removeFromWatchlist(entryId)
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

  async function handleSoloMarkWatched(entry: WatchlistMovieEntry) {
    setActionId(entry.id)
    await addToPersonalCollection(entry.movie.id)
    await soloWl.removeFromWatchlist(entry.id)
    setActionId(null)
  }

  async function handleSoloRemove(entryId: string) {
    setActionId(entryId)
    await soloWl.removeFromWatchlist(entryId)
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
            {entries.length + soloWl.entries.length + tvWatchlist.entries.length} élément{(entries.length + soloWl.entries.length + tvWatchlist.entries.length) !== 1 ? 's' : ''} dans la liste
            {activeCount > 0 && ` · ${filtered.length} affiché${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      <div className="px-4 mb-3 space-y-2">
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          + Ajouter {settings.showSeries ? 'un film ou une série' : 'un film'}
        </button>
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

      {/* Filter accordion */}
      {!loading && entries.length > 0 && (
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
      ) : entries.length === 0 ? (
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
        <>
        {coupleId && soloWl.entries.length > 0 && (
          <div className="px-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">En couple</p>
          </div>
        )}
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
                  {entry.movie.release_date && (
                    <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                      {new Date(entry.movie.release_date).getFullYear()}
                    </p>
                  )}
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

          {/* TV watchlist entries */}
          {tvWatchlist.entries.map(entry => (
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
        </>
      )}

      {/* Section solo — uniquement si l'utilisateur a un couple */}
      {coupleId && soloWl.entries.length > 0 && (
        <div className="mt-6">
          <div className="px-4 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium">À voir solo</p>
          </div>
          <ul className="px-4 space-y-3 pb-4">
            {soloWl.entries.map(entry => (
              <li
                key={`solo-${entry.id}`}
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
                    <button onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)} className="text-left">
                      <p className="font-semibold text-[var(--color-text)] leading-tight hover:text-[var(--color-accent)] transition-colors">
                        {entry.movie.title}
                      </p>
                    </button>
                    {entry.movie.release_date && (
                      <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                        {new Date(entry.movie.release_date).getFullYear()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 justify-start pt-1">
                    <button
                      onClick={() => handleSoloMarkWatched(entry)}
                      disabled={actionId === entry.id}
                      className="text-[var(--color-text-muted)] hover:text-green-400 text-xl transition-colors disabled:opacity-40"
                      title="Vu !"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => handleSoloRemove(entry.id)}
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
        </div>
      )}
    </div>
  )
}
