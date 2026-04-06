import { useEffect, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbGenre } from '../lib/tmdb'

let cachedMovieGenres: TmdbGenre[] | null = null
let cachedTvGenres: TmdbGenre[] | null = null

export function useGenres() {
  const [genres, setGenres] = useState<TmdbGenre[]>(cachedMovieGenres ?? [])
  const [tvGenres, setTvGenres] = useState<TmdbGenre[]>(cachedTvGenres ?? [])
  const [loading, setLoading] = useState(!cachedMovieGenres)

  useEffect(() => {
    const promises: Promise<void>[] = []

    if (!cachedMovieGenres) {
      promises.push(
        tmdb.getGenres().then(data => {
          cachedMovieGenres = data.genres
          setGenres(data.genres)
        })
      )
    }

    if (!cachedTvGenres) {
      promises.push(
        tmdb.getTvGenres().then(data => {
          cachedTvGenres = data.genres
          setTvGenres(data.genres)
        })
      )
    }

    if (promises.length > 0) {
      Promise.all(promises)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [])

  return { genres, tvGenres, loading }
}
