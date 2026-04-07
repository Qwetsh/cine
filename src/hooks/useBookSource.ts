import { useEffect, useState } from 'react'
import { tmdb, type TmdbKeyword } from '../lib/tmdb'
import { detectAdaptation, fetchBookSource, type BookSourceInfo } from '../lib/wikidata'

interface UseBookSourceResult {
  bookSource: BookSourceInfo | null
  adaptationType: string | null
  loading: boolean
}

// Déduplication des appels external_ids en vol
const externalIdsCache = new Map<number, Promise<{ wikidata_id: string | null }>>()

function getExternalIds(tmdbId: number) {
  if (externalIdsCache.has(tmdbId)) return externalIdsCache.get(tmdbId)!
  const promise = tmdb.getMovieExternalIds(tmdbId)
  externalIdsCache.set(tmdbId, promise)
  promise.finally(() => setTimeout(() => externalIdsCache.delete(tmdbId), 5000))
  return promise
}

export function useBookSource(
  tmdbId: number,
  keywords?: { keywords: TmdbKeyword[] },
): UseBookSourceResult {
  const [bookSource, setBookSource] = useState<BookSourceInfo | null>(null)
  const [adaptationType, setAdaptationType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!keywords?.keywords) return

    const type = detectAdaptation(keywords.keywords)
    if (!type) return

    let cancelled = false
    setAdaptationType(type)
    setLoading(true)

    getExternalIds(tmdbId)
      .then(ids => {
        if (cancelled || !ids.wikidata_id) return null
        return fetchBookSource(ids.wikidata_id)
      })
      .then(result => {
        if (!cancelled && result) setBookSource(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [tmdbId, keywords])

  return { bookSource, adaptationType, loading }
}
