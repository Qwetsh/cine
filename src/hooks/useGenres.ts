import { useEffect, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbGenre } from '../lib/tmdb'

let cachedGenres: TmdbGenre[] | null = null

export function useGenres() {
  const [genres, setGenres] = useState<TmdbGenre[]>(cachedGenres ?? [])
  const [loading, setLoading] = useState(!cachedGenres)

  useEffect(() => {
    if (cachedGenres) return
    tmdb.getGenres()
      .then(data => {
        cachedGenres = data.genres
        setGenres(data.genres)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return { genres, loading }
}
