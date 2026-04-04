import { useMemo, useState } from 'react'
import type { MovieWithPoster } from '../types'

export interface LocalFilters {
  query: string
  genres: string[]
  yearRange: [number, number] | null
}

const DEFAULT_FILTERS: LocalFilters = {
  query: '',
  genres: [],
  yearRange: null,
}

/** Extract unique sorted genre names from a list of movies */
export function extractGenres(entries: { movie: MovieWithPoster }[]): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    for (const g of e.movie.genres ?? []) set.add(g)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
}

/** Generic local filter hook for watchlist / collection entries */
export function useLocalFilter<T extends { movie: MovieWithPoster }>(entries: T[]) {
  const [filters, setFilters] = useState<LocalFilters>(DEFAULT_FILTERS)

  const availableGenres = useMemo(() => extractGenres(entries), [entries])

  const filtered = useMemo(() => {
    return entries.filter(entry => {
      // Text search on title
      if (filters.query.trim()) {
        const q = filters.query.trim().toLowerCase()
        if (!entry.movie.title.toLowerCase().includes(q)) return false
      }

      // Genre filter
      if (filters.genres.length > 0) {
        if (!filters.genres.some(g => (entry.movie.genres ?? []).includes(g))) return false
      }

      // Year range filter
      if (filters.yearRange) {
        const year = entry.movie.release_date
          ? new Date(entry.movie.release_date).getFullYear()
          : 0
        if (year < filters.yearRange[0] || year > filters.yearRange[1]) return false
      }

      return true
    })
  }, [entries, filters])

  const activeCount = filters.genres.length + (filters.yearRange ? 1 : 0) + (filters.query.trim() ? 1 : 0)

  function setQuery(query: string) {
    setFilters(prev => ({ ...prev, query }))
  }

  function toggleGenre(genre: string) {
    setFilters(prev => ({
      ...prev,
      genres: prev.genres.includes(genre)
        ? prev.genres.filter(g => g !== genre)
        : [...prev.genres, genre],
    }))
  }

  function setYearRange(range: [number, number] | null) {
    setFilters(prev => ({ ...prev, yearRange: range }))
  }

  function clearAll() {
    setFilters(DEFAULT_FILTERS)
  }

  return {
    filters,
    filtered,
    availableGenres,
    activeCount,
    setQuery,
    toggleGenre,
    setYearRange,
    clearAll,
  }
}
