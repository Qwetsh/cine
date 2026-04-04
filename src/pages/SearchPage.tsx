import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTmdbSearch } from '../hooks/useTmdbSearch'
import { tmdb } from '../lib/tmdb'
import { MovieGrid } from '../components/movie/MovieGrid'
import type { TmdbMovie } from '../lib/tmdb'

export function SearchPage() {
  const [query, setQuery] = useState('')
  const [popular, setPopular] = useState<TmdbMovie[]>([])
  const { results, loading, search, clear } = useTmdbSearch()
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Films populaires pour l'état vide
  useEffect(() => {
    tmdb.getPopular()
      .then(data => setPopular(data.results.slice(0, 12)))
      .catch(console.error)
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      clear()
      return
    }

    debounceRef.current = setTimeout(() => {
      search(value)
    }, 400)
  }

  const displayMovies = query.trim() ? results : popular
  const displayLoading = loading && query.trim() !== ''

  return (
    <div className="max-w-2xl mx-auto">
      {/* Barre de recherche */}
      <div className="sticky top-14 z-10 bg-[var(--color-bg)]/90 backdrop-blur px-4 py-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
            🔍
          </span>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Titre, acteur, réalisateur..."
            className="w-full bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] pl-10 pr-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
            autoFocus
          />
          {query && (
            <button
              onClick={() => { setQuery(''); clear(); inputRef.current?.focus() }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Titre section */}
      <div className="px-4 pt-2 pb-1">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
          {query.trim() ? `Résultats pour "${query}"` : 'Films populaires'}
        </p>
      </div>

      {/* Grille */}
      <MovieGrid
        movies={displayMovies}
        loading={displayLoading}
        onMovieClick={movie => navigate(`/movie/${movie.id}`)}
      />
    </div>
  )
}
