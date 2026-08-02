import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { useCollection } from '../hooks/useCollection'
import { useTvWatchlist } from '../hooks/useTvWatchlist'
import { useTvCollection } from '../hooks/useTvCollection'
import { useTvPersonalCollection } from '../hooks/useTvPersonalCollection'
import { useLocalFilter } from '../hooks/useLocalFilter'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useSettings } from '../hooks/useSettings'
import { getPosterUrl } from '../lib/tmdb'
import { detailPath } from '../lib/media'
import { tvShowToPosterMovie } from '../lib/media'
import { CollectionFilterPanel } from '../components/filters/CollectionFilterPanel'
import { HoldablePoster } from '../components/hold/HoldablePoster'
import { posterMovieFromDb } from '../lib/movies'
import { MarkWatchedModal, type MarkWatchedData } from '../components/movie/MarkWatchedModal'
import type { UnifiedWatchlistEntry } from '../types'

export function WatchlistPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const { settings } = useSettings()
  const { entries, loading, removeFromWatchlist } = useWatchlist(coupleId, user?.id)
  // Watchlist solo perso — utile uniquement quand on a un couple (sinon entries = solo)
  const soloWl = useWatchlist(null, coupleId ? user?.id : null)
  const { addToCollection } = useCollection(coupleId)
  const { addToPersonalCollection } = usePersonalCollection(user?.id ?? null)
  const showSeries = !settings.hideSeries
  const tvWatchlist = useTvWatchlist(showSeries ? coupleId : null, showSeries ? user?.id : null)
  const tvSoloWl = useTvWatchlist(null, showSeries && coupleId ? user?.id : null)
  const tvCollection = useTvCollection(coupleId)
  const tvPersonal = useTvPersonalCollection(user?.id ?? null)
  const [actionId, setActionId] = useState<string | null>(null)
  // coupleId est encore null pendant le chargement du CoupleProvider : tant
  // que l'utilisateur n'a pas choisi de vue, on suit la valeur résolue
  const [userViewMode, setViewMode] = useState<'couple' | 'solo' | null>(null)
  const viewMode: 'couple' | 'solo' = userViewMode ?? (coupleId ? 'couple' : 'solo')
  const [modalEntry, setModalEntry] = useState<UnifiedWatchlistEntry | null>(null)

  const isSoloView = !!coupleId && viewMode === 'solo'
  const activeEntries = isSoloView ? soloWl.entries : entries
  const activeTvEntries = isSoloView ? tvSoloWl.entries : tvWatchlist.entries

  // Liste unifiée films + séries, triée par date d'ajout
  const unified: UnifiedWatchlistEntry[] = useMemo(() => {
    const movies: UnifiedWatchlistEntry[] = activeEntries.map(e => ({ ...e, media_type: 'movie' as const }))
    const series: UnifiedWatchlistEntry[] = activeTvEntries.map(e => ({
      id: e.id,
      added_by: e.added_by,
      note: e.note,
      created_at: e.created_at,
      movie: tvShowToPosterMovie(e.tv_show),
      media_type: 'tv' as const,
      season_number: e.season_number,
      number_of_seasons: e.tv_show.number_of_seasons,
    }))
    return [...movies, ...series].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [activeEntries, activeTvEntries])

  const {
    filters, filtered, availableGenres, activeCount,
    setQuery, toggleGenre, setYearRange, clearAll,
  } = useLocalFilter(unified)

  async function handleModalConfirm(data: MarkWatchedData) {
    const entry = modalEntry
    if (!entry) return
    setModalEntry(null)
    setActionId(entry.id)

    const isSolo = !coupleId || viewMode === 'solo'
    const isTv = entry.media_type === 'tv'

    if (isSolo) {
      if (isTv) {
        await tvPersonal.addToTvPersonalCollection(entry.movie.id, {
          rating: data.myRating,
          note: data.myNote || null,
          emoji: data.myEmoji,
        })
      } else {
        await addToPersonalCollection(entry.movie.id, {
          rating: data.myRating,
          note: data.myNote || null,
          emoji: data.myEmoji,
        })
      }
      await handleRemoveEntry(entry)
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
      const { error } = isTv
        ? await tvCollection.addToTvCollection(entry.movie.id, extras)
        : await addToCollection(entry.movie.id, extras)
      if (!error) await handleRemoveEntry(entry)
    }

    setActionId(null)
  }

  async function handleRemoveEntry(entry: UnifiedWatchlistEntry) {
    if (entry.media_type === 'tv') {
      if (isSoloView) await tvSoloWl.removeFromTvWatchlist(entry.id)
      else await tvWatchlist.removeFromTvWatchlist(entry.id)
    } else {
      if (isSoloView) await soloWl.removeFromWatchlist(entry.id)
      else await removeFromWatchlist(entry.id)
    }
  }

  async function handleRemove(entry: UnifiedWatchlistEntry) {
    setActionId(entry.id)
    await handleRemoveEntry(entry)
    setActionId(null)
  }

  function getAddedByLabel(addedBy: string) {
    if (addedBy === user?.id) return 'Toi'
    return partner?.display_name ?? 'Partenaire'
  }

  const soloCount = soloWl.entries.length + tvSoloWl.entries.length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">À regarder</h1>
        {!loading && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {unified.length} élément{unified.length !== 1 ? 's' : ''}
            {activeCount > 0 && ` · ${filtered.length} affiché${filtered.length !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Toggle couple / solo */}
      {coupleId && (
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
              En couple
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
              Perso {soloCount > 0 && `(${soloCount})`}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 mb-3">
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          + Ajouter {showSeries ? 'un film ou une série' : 'un film'}
        </button>
      </div>

      {/* Filter accordion */}
      {!loading && unified.length > 0 && (
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
      ) : unified.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
          <span className="text-5xl mb-4">📋</span>
          <p className="font-medium">Votre liste est vide</p>
          <p className="text-sm mt-1">Ajoutez {showSeries ? 'des films et séries' : 'des films'} que vous voulez voir</p>
          <button
            onClick={() => navigate('/search')}
            className="mt-4 bg-[var(--color-accent)] text-white px-6 py-2 rounded-xl text-sm"
          >
            Parcourir
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
          <p className="text-sm">Aucun titre ne correspond aux filtres</p>
          <button onClick={clearAll} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
            Effacer les filtres
          </button>
        </div>
      ) : (
        <ul className="px-4 space-y-3 pb-4">
          {filtered.map(entry => {
            const path = detailPath({ id: entry.movie.tmdb_id, media_type: entry.media_type })
            const isTv = entry.media_type === 'tv'
            return (
              <li
                key={`${entry.media_type}-${entry.id}`}
                className="bg-[var(--color-surface)] rounded-xl overflow-hidden border border-[var(--color-border)]"
              >
                <div className="flex gap-3 p-3">
                  <HoldablePoster
                    movie={{ ...posterMovieFromDb(entry.movie), media_type: entry.media_type }}
                    movieDbId={entry.movie.id}
                    className="flex-shrink-0"
                  >
                    <button
                      onClick={() => navigate(path)}
                      className="relative w-16 h-24 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                    >
                      <img
                        src={getPosterUrl(entry.movie.poster_path, 'small')}
                        alt={`Affiche ${entry.movie.title}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {isTv && (
                        <div className="absolute top-1 right-1 bg-purple-600/90 text-white text-[8px] font-bold px-1 py-0.5 rounded">
                          Série
                        </div>
                      )}
                    </button>
                  </HoldablePoster>

                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(path)}
                      className="text-left"
                    >
                      <p className="font-semibold text-[var(--color-text)] leading-tight hover:text-[var(--color-accent)] transition-colors">
                        {entry.movie.title}
                      </p>
                    </button>
                    <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                      {entry.movie.release_date && new Date(entry.movie.release_date).getFullYear()}
                      {isTv
                        ? entry.number_of_seasons
                          ? ` · ${entry.number_of_seasons} saison${entry.number_of_seasons > 1 ? 's' : ''}`
                          : ''
                        : entry.movie.runtime
                          ? `${entry.movie.release_date ? ' · ' : ''}${Math.floor(entry.movie.runtime / 60)}h${(entry.movie.runtime % 60).toString().padStart(2, '0')}`
                          : ''}
                    </p>
                    {isTv && entry.season_number != null && (
                      <p className="text-purple-400 text-xs mt-0.5 font-medium">
                        Depuis la saison {entry.season_number}
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
                      onClick={() => setModalEntry(entry)}
                      disabled={actionId === entry.id}
                      className="text-[var(--color-text-muted)] hover:text-green-400 text-xl transition-colors disabled:opacity-40"
                      title="On l'a vu !"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => handleRemove(entry)}
                      disabled={actionId === entry.id}
                      className="text-[var(--color-text-muted)] hover:text-red-400 text-xl transition-colors disabled:opacity-40"
                      title="Retirer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
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
