import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { useCollection } from '../hooks/useCollection'
import { useLocalFilter } from '../hooks/useLocalFilter'
import { getPosterUrl } from '../lib/tmdb'
import { CollectionFilterPanel } from '../components/filters/CollectionFilterPanel'
import type { WatchlistMovieEntry } from '../types'

export function WatchlistPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, partner } = useCoupleContext()
  const { entries, loading, removeFromWatchlist } = useWatchlist(coupleId)
  const { addToCollection } = useCollection(coupleId)
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

  function getAddedByLabel(addedBy: string) {
    if (addedBy === user?.id) return 'Toi'
    return partner?.display_name ?? 'Partenaire'
  }

  if (!coupleId) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-16 text-center">
        <div className="text-5xl mb-4">💑</div>
        <p className="font-semibold text-[var(--color-text)] mb-2">Invitez votre partenaire d'abord</p>
        <p className="text-[var(--color-text-muted)] text-sm mb-6">
          La watchlist est partagée — liez vos comptes depuis votre profil.
        </p>
        <button
          onClick={() => navigate('/profile')}
          className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl text-sm font-medium"
        >
          Aller au profil
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">À regarder ensemble</h1>
        {!loading && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {entries.length} film{entries.length !== 1 ? 's' : ''} dans la liste
            {activeCount > 0 && ` · ${filtered.length} affiché${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      <div className="px-4 mb-3">
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          + Ajouter un film
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
          <p className="text-sm mt-1">Ajoutez des films que vous voulez voir ensemble</p>
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
                  {entry.movie.release_date && (
                    <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                      {new Date(entry.movie.release_date).getFullYear()}
                    </p>
                  )}
                  <p className="text-[var(--color-text-muted)] text-xs mt-2">
                    Ajouté par{' '}
                    <span className="text-[var(--color-text)]">
                      {getAddedByLabel(entry.added_by)}
                    </span>
                  </p>
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
        </ul>
      )}
    </div>
  )
}
