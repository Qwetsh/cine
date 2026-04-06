import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonCard } from '../components/search/PersonCard'
import { useTmdbSearch } from '../hooks/useTmdbSearch'
import { useGenres } from '../hooks/useGenres'
import { useSettings } from '../hooks/useSettings'
import { TvCard } from '../components/movie/TvCard'
import { MovieGrid } from '../components/movie/MovieGrid'
import { SegmentedControl } from '../components/search/SegmentedControl'
import { GenreChips } from '../components/search/GenreChips'
import { YearFilter } from '../components/search/YearFilter'
import { CountryChips } from '../components/search/CountryChips'
import { ActiveFilters } from '../components/search/ActiveFilters'
import type { TmdbTvShow } from '../lib/tmdb'

const PLACEHOLDERS: Record<string, string> = {
  title: 'Rechercher un film…',
  actor: 'Nom de l\'acteur…',
  director: 'Nom du réalisateur…',
}


function getSavedQuery(): string {
  try {
    const raw = sessionStorage.getItem('cine_search_state')
    if (!raw) return ''
    return JSON.parse(raw).query ?? ''
  } catch { return '' }
}

export function SearchPage() {
  const [query, setQuery] = useState(getSavedQuery)
  const { settings } = useSettings()
  const {
    results, tvResults, loading, hasMore, filters, matchedPerson,
    search, loadMore, setMode, setMediaType, toggleGenre, setYearRange, setCountry, clearFilters, clear, saveState,
  } = useTmdbSearch(settings.showSeries)
  const { genres } = useGenres()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const navigate = useNavigate()
  const isTvMode = filters.mediaType === 'tv'
  const hasTvResults = isTvMode && tvResults.length > 0

  const hasFilters = filters.genres.length > 0 || filters.yearRange !== null || filters.country !== null

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      if (hasFilters) {
        // Pas de texte mais filtres actifs → relancer discover
        debounceRef.current = setTimeout(() => search(''), 200)
      } else {
        clear()
      }
      return
    }

    debounceRef.current = setTimeout(() => search(value), 400)
  }

  function handleClear() {
    setQuery('')
    clear()
    inputRef.current?.focus()
  }

  function getSectionTitle() {
    if (isTvMode) {
      if (query.trim()) return `Séries pour "${query}"`
      return 'Séries tendances'
    }
    if (query.trim() && filters.mode === 'title') return `Résultats pour "${query}"`
    if (query.trim() && filters.mode === 'actor') return `Films avec "${query}"`
    if (query.trim() && filters.mode === 'director') return `Films de "${query}"`
    if (hasFilters) return 'Films filtrés'
    if (!query.trim() && results.length > 0) return 'Films populaires'
    return 'Films populaires'
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Sticky search header */}
      <div className="sticky top-14 z-10 bg-[var(--color-bg)]/90 backdrop-blur px-4 pt-3 pb-2 space-y-3">
        {/* Media type toggle — Films / Séries */}
        {settings.showSeries && (
          <div className="flex rounded-xl bg-[var(--color-surface-2)] p-1">
            <button
              onClick={() => setMediaType('movie')}
              className={[
                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                filters.mediaType === 'movie'
                  ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              Films
            </button>
            <button
              onClick={() => setMediaType('tv')}
              className={[
                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                filters.mediaType === 'tv'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              Séries
            </button>
          </div>
        )}

        {/* Search mode — only for movies */}
        {filters.mediaType === 'movie' && (
          <SegmentedControl value={filters.mode} onChange={setMode} />
        )}

        {/* Search input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
            🔍
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder={isTvMode ? 'Rechercher une série…' : PLACEHOLDERS[filters.mode]}
            className="w-full bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] pl-10 pr-10 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
            autoFocus
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              ✕
            </button>
          )}
        </div>

        {/* Genre/Year/Country chips — movies only */}
        {!isTvMode && (
          <>
            <GenreChips
              genres={genres}
              selected={filters.genres}
              onToggle={toggleGenre}
            />
            <YearFilter
              value={filters.yearRange}
              onChange={setYearRange}
            />
            <CountryChips
              selected={filters.country}
              onSelect={setCountry}
            />
          </>
        )}
      </div>

      {/* Active filter pills — movies only */}
      {!isTvMode && (
        <ActiveFilters
          filters={filters}
          genres={genres}
          onRemoveGenre={toggleGenre}
          onRemoveYearRange={() => setYearRange(null)}
          onRemoveCountry={() => setCountry(null)}
          onClearAll={clearFilters}
        />
      )}

      {/* Person info card */}
      {matchedPerson && !isTvMode && (
        <PersonCard person={matchedPerson} filmCount={results.length} />
      )}

      {/* Section title */}
      <div className="px-4 pt-2 pb-1">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
          {getSectionTitle()}
        </p>
      </div>

      {/* Results grid */}
      {isTvMode ? (
        <TvGrid
          shows={tvResults}
          loading={loading}
          onClick={show => { saveState(); navigate(`/tv/${show.id}`) }}
        />
      ) : (
        <MovieGrid
          movies={results}
          loading={loading}
          onMovieClick={movie => { saveState(); navigate(`/movie/${movie.id}`) }}
        />
      )}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="px-4 py-6 text-center">
          <button
            onClick={loadMore}
            className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm font-medium px-6 py-2.5 rounded-xl border border-[var(--color-border)] transition-colors"
          >
            Voir plus
          </button>
        </div>
      )}
    </div>
  )
}

function TvGrid({
  shows,
  loading,
  onClick,
}: {
  shows: TmdbTvShow[]
  loading: boolean
  onClick: (s: TmdbTvShow) => void
}) {
  if (loading && shows.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-3 p-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] bg-[var(--color-surface-2)] rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!loading && shows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
        <span className="text-4xl mb-3">📺</span>
        <p>Aucune série trouvée</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {shows.map(show => (
        <TvCard
          key={show.id}
          show={show}
          onClick={() => onClick(show)}
        />
      ))}
    </div>
  )
}
