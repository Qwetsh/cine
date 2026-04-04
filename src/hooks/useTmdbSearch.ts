import { useCallback, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie } from '../lib/tmdb'

export function useTmdbSearch() {
  const [results, setResults] = useState<TmdbMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentQuery, setCurrentQuery] = useState('')

  const search = useCallback(async (query: string, page = 1) => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    setError(null)
    setCurrentQuery(query)
    setCurrentPage(page)

    try {
      const data = await tmdb.searchMovies(query, page)
      setResults(page === 1 ? data.results : prev => [...prev, ...data.results])
      setTotalPages(data.total_pages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadMore = useCallback(() => {
    if (currentPage < totalPages) {
      search(currentQuery, currentPage + 1)
    }
  }, [currentPage, totalPages, currentQuery, search])

  const clear = useCallback(() => {
    setResults([])
    setCurrentQuery('')
    setCurrentPage(1)
    setTotalPages(0)
  }, [])

  return {
    results,
    loading,
    error,
    totalPages,
    currentPage,
    hasMore: currentPage < totalPages,
    search,
    loadMore,
    clear,
  }
}
