import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonCard } from '../components/search/PersonCard'
import { useTmdbSearch } from '../hooks/useTmdbSearch'
import { useGenres } from '../hooks/useGenres'
import { useSettings } from '../hooks/useSettings'
import { MovieGrid } from '../components/movie/MovieGrid'
import { SegmentedControl } from '../components/search/SegmentedControl'
import { GenreChips } from '../components/search/GenreChips'
import { YearFilter } from '../components/search/YearFilter'
import { CountryChips } from '../components/search/CountryChips'
import { ActiveFilters } from '../components/search/ActiveFilters'
import { detailPath } from '../lib/media'

const PLACEHOLDERS: Record<string, string> = {
  title: 'Rechercher un film, une série…',
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
  const includeSeries = !settings.hideSeries
  const {
    results, loading, hasMore, filters, matchedPerson,
    search, loadMore, setMode, toggleGenre, setYearRange, setCountry, clearFilters, clear, saveState,
  } = useTmdbSearch(includeSeries)
  const { genres } = useGenres()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const navigate = useNavigate()

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
    const noun = includeSeries ? 'Titres' : 'Films'
    if (query.trim() && filters.mode === 'title') return `Résultats pour "${query}"`
    if (query.trim() && filters.mode === 'actor') return `Films avec "${query}"`
    if (query.trim() && filters.mode === 'director') return `Films de "${query}"`
    if (hasFilters) return `${noun} filtrés`
    return `${noun} populaires`
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Sticky search header — compact: mode + input only */}
      <div className="sticky top-14 z-10 bg-[var(--color-bg)]/90 backdrop-blur px-4 pt-0 pb-2 space-y-2">
        {/* Search mode — Titre / Acteur / Réalisateur */}
        <SegmentedControl value={filters.mode} onChange={setMode} />

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
            placeholder={filters.mode === 'title' && !includeSeries ? 'Rechercher un film…' : PLACEHOLDERS[filters.mode]}
            className="w-full bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] pl-10 pr-10 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
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

        {/* Filters — only in title mode, not actor/director */}
        {filters.mode === 'title' && (
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

        {/* Person info card — inside sticky to stay visible */}
        {matchedPerson && (
          <PersonCard person={matchedPerson} filmCount={results.length} />
        )}
      </div>

      {/* Active filter pills */}
      <ActiveFilters
        filters={filters}
        genres={genres}
        onRemoveGenre={toggleGenre}
        onRemoveYearRange={() => setYearRange(null)}
        onRemoveCountry={() => setCountry(null)}
        onClearAll={clearFilters}
      />

      {/* Section title */}
      <div className="px-4 pt-2 pb-1">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
          {getSectionTitle()}
        </p>
      </div>

      {/* Results grid — mixte films + séries */}
      <MovieGrid
        movies={results}
        loading={loading}
        onMovieClick={item => { saveState(); navigate(detailPath(item)) }}
      />

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
