import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalFilter } from '../../hooks/useLocalFilter'
import { CollectionFilterPanel } from '../filters/CollectionFilterPanel'
import { getPosterUrl } from '../../lib/tmdb'
import type { WatchlistMovieEntry } from '../../types'

interface Props {
  entries: WatchlistMovieEntry[]
  loading: boolean
  onMarkWatched: (entry: WatchlistMovieEntry) => Promise<void>
}

export function WatchlistPicker({ entries, loading, onMarkWatched }: Props) {
  const navigate = useNavigate()
  const {
    filters, filtered, availableGenres, activeCount,
    setQuery, toggleGenre, setYearRange, clearAll,
  } = useLocalFilter(entries)

  const [picked, setPicked] = useState<WatchlistMovieEntry | null>(null)
  const [rolling, setRolling] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const rollInterval = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  // Cleanup interval on unmount
  useEffect(() => {
    return () => { if (rollInterval.current) clearInterval(rollInterval.current) }
  }, [])

  const pickRandom = useCallback(() => {
    if (filtered.length === 0) return
    if (filtered.length === 1) {
      setPicked(filtered[0])
      return
    }

    // Rolling animation: cycle through movies quickly then slow down
    setRolling(true)
    setPicked(null)

    let count = 0
    const totalSteps = 15
    let delay = 60

    function step() {
      const idx = Math.floor(Math.random() * filtered.length)
      setPicked(filtered[idx])
      count++

      if (count >= totalSteps) {
        setRolling(false)
        return
      }

      // Slow down progressively
      delay = 60 + (count / totalSteps) * 300
      rollInterval.current = setTimeout(step, delay)
    }

    step()
  }, [filtered])

  async function handleMarkWatched() {
    if (!picked) return
    setActionLoading(true)
    await onMarkWatched(picked)
    setPicked(null)
    setActionLoading(false)
  }

  if (loading) {
    return (
      <div className="px-4 py-8">
        <div className="h-40 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
        <span className="text-5xl mb-4">📋</span>
        <p className="font-medium">Votre liste est vide</p>
        <p className="text-sm mt-1">Ajoutez des films à votre liste d'abord</p>
        <button
          onClick={() => navigate('/search')}
          className="mt-4 bg-[var(--color-accent)] text-white px-6 py-2 rounded-xl text-sm"
        >
          Parcourir les films
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <CollectionFilterPanel
        filters={filters}
        availableGenres={availableGenres}
        activeCount={activeCount}
        onQueryChange={setQuery}
        onToggleGenre={toggleGenre}
        onYearRangeChange={setYearRange}
        onClearAll={clearAll}
      />

      <div className="px-4 mb-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          {filtered.length} film{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Pick button */}
      <div className="px-4 mb-4">
        <button
          onClick={pickRandom}
          disabled={filtered.length === 0 || rolling}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60 text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
        >
          {rolling ? 'Tirage en cours…' : '🎲 Piocher au hasard'}
        </button>
      </div>

      {/* Result */}
      {picked && (
        <div className={`mx-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden transition-opacity ${rolling ? 'opacity-60' : 'opacity-100'}`}>
          <div className="flex gap-4 p-4">
            <button
              onClick={() => navigate(`/movie/${picked.movie.tmdb_id}`)}
              className="w-24 flex-shrink-0 rounded-xl overflow-hidden shadow-lg"
            >
              <img
                src={getPosterUrl(picked.movie.poster_path, 'medium')}
                alt={picked.movie.title}
                className="w-full"
              />
            </button>
            <div className="flex-1 min-w-0">
              <button onClick={() => navigate(`/movie/${picked.movie.tmdb_id}`)} className="text-left">
                <h3 className="font-bold text-lg text-[var(--color-text)] leading-tight hover:text-[var(--color-accent)] transition-colors">
                  {picked.movie.title}
                </h3>
              </button>
              {picked.movie.release_date && (
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {new Date(picked.movie.release_date).getFullYear()}
                </p>
              )}
              {(picked.movie.genres ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {picked.movie.genres.map(g => (
                    <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!rolling && (
            <div className="border-t border-[var(--color-border)] p-3 flex gap-2">
              <button
                onClick={handleMarkWatched}
                disabled={actionLoading}
                className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60 text-white rounded-xl py-2.5 font-medium text-sm transition-colors"
              >
                {actionLoading ? '…' : 'On le regarde !'}
              </button>
              <button
                onClick={pickRandom}
                className="flex-1 bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] rounded-xl py-2.5 font-medium text-sm transition-colors"
              >
                Repiocher
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
