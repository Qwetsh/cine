import { useCallback, useEffect, useRef, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie, TmdbTvShow, TmdbPersonDetail, SearchMode, MediaType, SearchFilters } from '../lib/tmdb'

const DEFAULT_FILTERS: SearchFilters = {
  mode: 'title',
  mediaType: 'movie',
  genres: [],
  yearRange: null,
  country: null,
}

type PagedResult<T> = { results: T[]; total_pages: number }

interface SearchContext {
  trimmed: string
  hasQuery: boolean
  hasGenres: boolean
  hasYear: boolean
  hasCountry: boolean
  hasAnyFilter: boolean
  filters: SearchFilters
  page: number
}

function buildContext(query: string, filters: SearchFilters, page: number): SearchContext {
  const trimmed = query.trim()
  return {
    trimmed,
    hasQuery: trimmed !== '',
    hasGenres: filters.genres.length > 0,
    hasYear: filters.yearRange !== null,
    hasCountry: filters.country !== null,
    hasAnyFilter: filters.genres.length > 0 || filters.yearRange !== null || filters.country !== null,
    filters,
    page,
  }
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

async function searchTv(ctx: SearchContext): Promise<PagedResult<TmdbTvShow>> {
  const { trimmed, hasQuery, hasAnyFilter, filters, page } = ctx

  if (hasQuery && !hasAnyFilter) {
    return tmdb.searchTv(trimmed, page)
  }

  if (hasAnyFilter || !hasQuery) {
    const params: Record<string, string | number | undefined> = {}
    if (ctx.hasGenres) params.with_genres = filters.genres.join(',')
    if (ctx.hasYear) {
      params['first_air_date.gte'] = `${filters.yearRange![0]}-01-01`
      params['first_air_date.lte'] = `${filters.yearRange![1]}-12-31`
    }
    if (ctx.hasCountry) params.with_origin_country = filters.country!
    params['vote_count.gte'] = '10'
    params.sort_by = 'popularity.desc'
    params.page = page

    const data = await tmdb.discoverTv(params)
    if (!hasQuery) return data

    const lower = trimmed.toLowerCase()
    return {
      results: data.results.filter(s =>
        s.name.toLowerCase().includes(lower) ||
        s.original_name.toLowerCase().includes(lower)
      ),
      total_pages: data.total_pages,
    }
  }

  return tmdb.getTrendingTv('week')
}

async function searchMovies(
  ctx: SearchContext,
  personIdRef: React.MutableRefObject<number | null>,
  setMatchedPerson: (p: TmdbPersonDetail | null) => void,
  reqId: number,
  requestIdRef: React.MutableRefObject<number>,
): Promise<PagedResult<TmdbMovie> | null> {
  const { trimmed, hasQuery, hasAnyFilter, hasCountry, filters, page } = ctx

  const discoverParams: Record<string, string | number | undefined> = {}
  if (ctx.hasGenres) discoverParams.with_genres = filters.genres.join(',')
  if (ctx.hasYear) {
    discoverParams['primary_release_date.gte'] = `${filters.yearRange![0]}-01-01`
    discoverParams['primary_release_date.lte'] = `${filters.yearRange![1]}-12-31`
  }
  if (hasCountry) discoverParams.with_origin_country = filters.country!
  discoverParams['vote_count.gte'] = '10'
  discoverParams.page = page

  // Title search without filters
  if (filters.mode === 'title' && hasQuery && !hasAnyFilter) {
    return tmdb.searchMovies(trimmed, page)
  }

  // Title search with non-country filters (client-side filtering)
  if (filters.mode === 'title' && hasQuery && hasAnyFilter && !hasCountry) {
    const raw = await tmdb.searchMovies(trimmed, page)
    return {
      results: applyClientFilters(raw.results, filters),
      total_pages: raw.total_pages,
    }
  }

  // Title search with country filter (discover + client title filter)
  if (filters.mode === 'title' && hasQuery && hasAnyFilter && hasCountry) {
    discoverParams.sort_by = 'popularity.desc'
    const data = await tmdb.discoverMovies(discoverParams)
    const lower = trimmed.toLowerCase()
    return {
      results: data.results.filter(m =>
        m.title.toLowerCase().includes(lower) ||
        m.original_title.toLowerCase().includes(lower)
      ),
      total_pages: data.total_pages,
    }
  }

  // Discover with filters, no query
  if (filters.mode === 'title' && !hasQuery && hasAnyFilter) {
    return tmdb.discoverMovies(discoverParams)
  }

  // Person search (actor/director)
  if ((filters.mode === 'actor' || filters.mode === 'director') && hasQuery) {
    if (!personIdRef.current) {
      const personData = await tmdb.searchPerson(trimmed)
      const dept = filters.mode === 'actor' ? 'Acting' : 'Directing'
      const person = personData.results.find(p => p.known_for_department === dept)
        ?? personData.results[0]
      if (!person) {
        if (reqId === requestIdRef.current) setMatchedPerson(null)
        return { results: [], total_pages: 0 }
      }
      personIdRef.current = person.id
      tmdb.getPerson(person.id).then(detail => {
        if (reqId === requestIdRef.current) setMatchedPerson(detail)
      }).catch(() => {})
    }

    if (filters.mode === 'actor') {
      discoverParams.with_cast = String(personIdRef.current)
    } else {
      discoverParams.with_crew = String(personIdRef.current)
    }
    return tmdb.discoverMovies(discoverParams)
  }

  // No query, no filters → popular
  if (!hasQuery && !hasAnyFilter) {
    return tmdb.getPopular(page)
  }

  return { results: [], total_pages: 0 }
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
      const ctx = buildContext(query, searchFilters, page)

      if (searchFilters.mediaType === 'tv') {
        const tvData = await searchTv(ctx)
        if (reqId !== requestIdRef.current) return
        setResults([])
        setTvResults(prev => append ? [...prev, ...tvData.results] : tvData.results)
        setTotalPages(tvData.total_pages)
        setCurrentPage(page)
        setLoading(false)
        return
      }

      const data = await searchMovies(ctx, personIdRef, setMatchedPerson, reqId, requestIdRef)
      if (reqId !== requestIdRef.current) return
      if (!data) return

      setResults(prev => append ? [...prev, ...data.results] : data.results)
      setTvResults([])
      setTotalPages(data.total_pages)
      setCurrentPage(page)
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

  const setMediaType = useCallback((mediaType: MediaType) => {
    setFilters(prev => {
      const next = { ...prev, mediaType, mode: 'title' as SearchMode, genres: [], yearRange: null, country: null }
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
    setMediaType,
    toggleGenre,
    setYearRange,
    setCountry,
    clearFilters,
    clear,
    saveState,
  }
}
