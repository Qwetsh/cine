import { useCallback, useEffect, useRef, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie, TmdbTvShow, TmdbPersonDetail, SearchMode, SearchFilters } from '../lib/tmdb'

const DEFAULT_FILTERS: SearchFilters = {
  mode: 'title',
  genres: [],
  yearRange: null,
  country: null,
}

function applyClientFilters(movies: TmdbMovie[], filters: SearchFilters): TmdbMovie[] {
  return movies.filter(movie => {
    if (filters.genres.length > 0) {
      if (!filters.genres.some(g => movie.genre_ids.includes(g))) return false
    }
    if (filters.yearRange) {
      const year = movie.release_date ? new Date(movie.release_date).getFullYear() : 0
      if (year < filters.yearRange[0] || year > filters.yearRange[1]) return false
    }
    return true
  })
}

const STORAGE_KEY = 'cine_search_state'

function loadSavedState(): { query: string; filters: SearchFilters } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function useTmdbSearch(showSeries = false) {
  const saved = loadSavedState()

  const [results, setResults] = useState<TmdbMovie[]>([])
  const [tvResults, setTvResults] = useState<TmdbTvShow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<SearchFilters>(saved?.filters ?? DEFAULT_FILTERS)
  const [matchedPerson, setMatchedPerson] = useState<TmdbPersonDetail | null>(null)
  const showSeriesRef = useRef(showSeries)
  showSeriesRef.current = showSeries

  const queryRef = useRef(saved?.query ?? '')
  const personIdRef = useRef<number | null>(null)
  const requestIdRef = useRef(0)

  const executeSearch = useCallback(async (
    query: string,
    searchFilters: SearchFilters,
    page: number,
    append: boolean
  ) => {
    const reqId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const trimmed = query.trim()
      const hasQuery = trimmed !== ''
      const hasGenres = searchFilters.genres.length > 0
      const hasYear = searchFilters.yearRange !== null
      const hasCountry = searchFilters.country !== null
      const hasAnyFilter = hasGenres || hasYear || hasCountry

      const discoverParams: Record<string, string | number | undefined> = {}
      if (hasGenres) discoverParams.with_genres = searchFilters.genres.join(',')
      if (hasYear) {
        discoverParams['primary_release_date.gte'] = `${searchFilters.yearRange![0]}-01-01`
        discoverParams['primary_release_date.lte'] = `${searchFilters.yearRange![1]}-12-31`
      }
      if (hasCountry) discoverParams.with_origin_country = searchFilters.country!
      discoverParams['vote_count.gte'] = '10'
      discoverParams.page = page

      let data: { results: TmdbMovie[]; total_pages: number }

      if (searchFilters.mode === 'title' && hasQuery && !hasAnyFilter) {
        // Case 1: Title search only
        data = await tmdb.searchMovies(trimmed, page)
      } else if (searchFilters.mode === 'title' && hasQuery && hasAnyFilter && !hasCountry) {
        // Case 2: Title + genre/year filters → search + client-side filter
        const raw = await tmdb.searchMovies(trimmed, page)
        data = {
          results: applyClientFilters(raw.results, searchFilters),
          total_pages: raw.total_pages,
        }
      } else if (searchFilters.mode === 'title' && hasQuery && hasAnyFilter && hasCountry) {
        // Case 2b: Title + country → discover (country needs server-side)
        discoverParams.sort_by = 'popularity.desc'
        data = await tmdb.discoverMovies(discoverParams)
        // Client-side title filter on discover results
        const lower = trimmed.toLowerCase()
        data = {
          results: data.results.filter(m =>
            m.title.toLowerCase().includes(lower) ||
            m.original_title.toLowerCase().includes(lower)
          ),
          total_pages: data.total_pages,
        }
      } else if (searchFilters.mode === 'title' && !hasQuery && hasAnyFilter) {
        // Case 3: Filters only → discover
        data = await tmdb.discoverMovies(discoverParams)
      } else if ((searchFilters.mode === 'actor' || searchFilters.mode === 'director') && hasQuery) {
        // Case 4/5: Person search → discover
        if (!append || !personIdRef.current) {
          const personData = await tmdb.searchPerson(trimmed)
          const dept = searchFilters.mode === 'actor' ? 'Acting' : 'Directing'
          const person = personData.results.find(p => p.known_for_department === dept)
            ?? personData.results[0]
          if (!person) {
            if (reqId === requestIdRef.current) {
              setResults([])
              setTotalPages(0)
              setMatchedPerson(null)
              setLoading(false)
            }
            return
          }
          personIdRef.current = person.id
          // Fetch full person details (biography, birthday, etc.)
          tmdb.getPerson(person.id).then(detail => {
            if (reqId === requestIdRef.current) setMatchedPerson(detail)
          }).catch(() => { /* non-blocking */ })
        }

        if (searchFilters.mode === 'actor') {
          discoverParams.with_cast = String(personIdRef.current)
        } else {
          discoverParams.with_crew = String(personIdRef.current)
        }
        data = await tmdb.discoverMovies(discoverParams)
      } else if (!hasQuery && !hasAnyFilter) {
        // Case 5: No query, no filters → popular
        data = await tmdb.getPopular(page)
      } else {
        data = { results: [], total_pages: 0 }
      }

      if (reqId !== requestIdRef.current) return // stale

      setResults(prev => append ? [...prev, ...data.results] : data.results)
      setTotalPages(data.total_pages)
      setCurrentPage(page)

      // Parallel TV search when series enabled (title mode only)
      if (showSeriesRef.current && searchFilters.mode === 'title') {
        if (hasQuery) {
          tmdb.searchTv(trimmed, page).then(tvData => {
            if (reqId !== requestIdRef.current) return
            setTvResults(prev => append ? [...prev, ...tvData.results] : tvData.results)
          }).catch(() => {})
        } else if (!hasAnyFilter) {
          tmdb.getTrendingTv('week').then(tvData => {
            if (reqId !== requestIdRef.current) return
            setTvResults(prev => append ? [...prev, ...tvData.results] : tvData.results)
          }).catch(() => {})
        } else {
          setTvResults([])
        }
      } else {
        setTvResults([])
      }
    } catch (err) {
      if (reqId !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche')
    } finally {
      if (reqId === requestIdRef.current) setLoading(false)
    }
  }, [])

  // Restore saved search or load popular on mount
  useEffect(() => {
    executeSearch(queryRef.current, filters, 1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const search = useCallback((query: string) => {
    queryRef.current = query
    personIdRef.current = null
    setMatchedPerson(null)
    executeSearch(query, filters, 1, false)
  }, [filters, executeSearch])

  const refresh = useCallback(() => {
    personIdRef.current = null
    executeSearch(queryRef.current, filters, 1, false)
  }, [filters, executeSearch])

  const loadMore = useCallback(() => {
    if (currentPage < totalPages && !loading) {
      executeSearch(queryRef.current, filters, currentPage + 1, true)
    }
  }, [currentPage, totalPages, loading, filters, executeSearch])

  const setMode = useCallback((mode: SearchMode) => {
    setFilters(prev => {
      const next = { ...prev, mode }
      personIdRef.current = null
      setMatchedPerson(null)
      executeSearch(queryRef.current, next, 1, false)
      return next
    })
  }, [executeSearch])

  const toggleGenre = useCallback((genreId: number) => {
    setFilters(prev => {
      const genres = prev.genres.includes(genreId)
        ? prev.genres.filter(g => g !== genreId)
        : [...prev.genres, genreId]
      const next = { ...prev, genres }
      executeSearch(queryRef.current, next, 1, false)
      return next
    })
  }, [executeSearch])

  const setYearRange = useCallback((range: [number, number] | null) => {
    setFilters(prev => {
      const next = { ...prev, yearRange: range }
      executeSearch(queryRef.current, next, 1, false)
      return next
    })
  }, [executeSearch])

  const setCountry = useCallback((country: string | null) => {
    setFilters(prev => {
      const next = { ...prev, country }
      executeSearch(queryRef.current, next, 1, false)
      return next
    })
  }, [executeSearch])

  const clearFilters = useCallback(() => {
    setFilters(prev => {
      const next = { ...prev, genres: [], yearRange: null, country: null }
      executeSearch(queryRef.current, next, 1, false)
      return next
    })
  }, [executeSearch])

  const clear = useCallback(() => {
    queryRef.current = ''
    personIdRef.current = null
    setMatchedPerson(null)
    setResults([])
    setTvResults([])
    setTotalPages(0)
    setCurrentPage(1)
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  // Save current state to sessionStorage (call before navigating away)
  const saveState = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      query: queryRef.current,
      filters,
    }))
  }, [filters])

  return {
    results,
    tvResults,
    loading,
    error,
    hasMore: currentPage < totalPages,
    filters,
    matchedPerson,
    search,
    refresh,
    loadMore,
    setMode,
    toggleGenre,
    setYearRange,
    setCountry,
    clearFilters,
    clear,
    saveState,
  }
}
