import { useEffect, useState } from 'react'
import { tmdb, type TmdbKeyword } from '../lib/tmdb'
import { detectAdaptation, fetchBookSource, type BookSourceInfo } from '../lib/wikidata'

interface UseBookSourceResult {
  bookSource: BookSourceInfo | null
  adaptationType: string | null
  loading: boolean
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

    setAdaptationType(type)
    setLoading(true)

    tmdb.getMovieExternalIds(tmdbId)
      .then(ids => {
        if (!ids.wikidata_id) {
          setLoading(false)
          return
        }
        return fetchBookSource(ids.wikidata_id)
      })
      .then(result => {
        if (result) setBookSource(result)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tmdbId, keywords])

  return { bookSource, adaptationType, loading }
}
