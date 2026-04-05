import { useCallback, useEffect, useRef, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../lib/tmdb'
import type { CollectionMovieEntry, WatchlistMovieEntry } from '../types'

/**
 * Build personalized recommendations from collection + watchlist.
 *
 * Algorithm:
 * 1. Build genre preference profile (weighted by ratings)
 * 2. Discover movies by top genres (random TMDB page for variety)
 * 3. Fetch similar movies for random highly-rated films
 * 4. Merge, exclude already seen/watchlisted, shuffle, pick 9
 */

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n)
}

function ratingWeight(rating: number | null): number {
  if (rating == null) return 1
  if (rating >= 9) return 3
  if (rating >= 7) return 2
  return 1
}

interface GenreScore {
  id: number
  name: string
  score: number
}

function buildGenreProfile(
  collection: CollectionMovieEntry[],
  watchlist: WatchlistMovieEntry[],
  genreMap: Map<string, number>, // name → id
): GenreScore[] {
  const scores = new Map<number, { name: string; score: number }>()

  for (const entry of collection) {
    const weight = Math.max(
      ratingWeight(entry.rating_user1),
      ratingWeight(entry.rating_user2),
    )
    for (const genreName of entry.movie.genres) {
      const genreId = genreMap.get(genreName)
      if (!genreId) continue
      const cur = scores.get(genreId) ?? { name: genreName, score: 0 }
      cur.score += weight
      scores.set(genreId, cur)
    }
  }

  for (const entry of watchlist) {
    for (const genreName of entry.movie.genres) {
      const genreId = genreMap.get(genreName)
      if (!genreId) continue
      const cur = scores.get(genreId) ?? { name: genreName, score: 0 }
      cur.score += 1
      scores.set(genreId, cur)
    }
  }

  return Array.from(scores.entries())
    .map(([id, { name, score }]) => ({ id, name, score }))
    .sort((a, b) => b.score - a.score)
}

function getHighRatedMovies(collection: CollectionMovieEntry[]): CollectionMovieEntry[] {
  return collection.filter(e => {
    const best = Math.max(e.rating_user1 ?? 0, e.rating_user2 ?? 0)
    return best >= 7
  })
}

export function useRecommendations(
  collection: CollectionMovieEntry[],
  watchlist: WatchlistMovieEntry[],
  genres: TmdbGenre[],
  enabled: boolean,
) {
  const [results, setResults] = useState<TmdbMovie[]>([])
  const [loading, setLoading] = useState(false)
  const didFetchRef = useRef(false)
  const dataKeyRef = useRef('')

  const refresh = useCallback(async () => {
    if (genres.length === 0) return
    if (collection.length === 0 && watchlist.length === 0) return

    setLoading(true)

    try {
      // Build genre map: name → id
      const genreMap = new Map<string, number>()
      for (const g of genres) genreMap.set(g.name, g.id)

      // Genre profile
      const profile = buildGenreProfile(collection, watchlist, genreMap)
      if (profile.length === 0) {
        setResults([])
        return
      }

      // Set of tmdb_ids to exclude
      const excludeIds = new Set<number>()
      for (const e of collection) excludeIds.add(e.movie.tmdb_id)
      for (const e of watchlist) excludeIds.add(e.movie.tmdb_id)

      const allMovies: TmdbMovie[] = []

      // --- Discover by top genres (2 calls, random pages) ---
      const topGenres = profile.slice(0, 4)
      const randomPage = () => Math.floor(Math.random() * 5) + 1

      if (topGenres.length >= 2) {
        // Call 1: top 2 genres combined
        const p1 = tmdb.discoverMovies({
          with_genres: `${topGenres[0].id},${topGenres[1].id}`,
          sort_by: 'popularity.desc',
          'vote_count.gte': '50',
          page: randomPage(),
        }).catch(() => ({ results: [] as TmdbMovie[], total_pages: 0 }))

        // Call 2: genre #3 or #1 alone (for variety)
        const soloGenre = topGenres[2] ?? topGenres[0]
        const p2 = tmdb.discoverMovies({
          with_genres: String(soloGenre.id),
          sort_by: 'popularity.desc',
          'vote_count.gte': '50',
          page: randomPage(),
        }).catch(() => ({ results: [] as TmdbMovie[], total_pages: 0 }))

        const [d1, d2] = await Promise.all([p1, p2])
        allMovies.push(...d1.results, ...d2.results)
      } else if (topGenres.length === 1) {
        const d = await tmdb.discoverMovies({
          with_genres: String(topGenres[0].id),
          sort_by: 'popularity.desc',
          'vote_count.gte': '50',
          page: randomPage(),
        }).catch(() => ({ results: [] as TmdbMovie[], total_pages: 0 }))
        allMovies.push(...d.results)
      }

      // --- Similar movies from random highly-rated films ---
      const highRated = getHighRatedMovies(collection)
      if (highRated.length > 0) {
        const seeds = pickRandom(highRated, 3)
        const similarPromises = seeds.map(e =>
          tmdb.getSimilar(e.movie.tmdb_id)
            .then(d => d.results)
            .catch(() => [] as TmdbMovie[])
        )
        const similarResults = await Promise.all(similarPromises)
        for (const movies of similarResults) {
          allMovies.push(...movies)
        }
      }

      // --- Merge, deduplicate, exclude, score, shuffle ---
      const seen = new Set<number>()
      const unique: TmdbMovie[] = []
      for (const m of allMovies) {
        if (excludeIds.has(m.id) || seen.has(m.id)) continue
        if (!m.poster_path) continue
        seen.add(m.id)
        unique.push(m)
      }

      // Score by genre match + popularity + rating
      const topGenreIds = new Set(profile.slice(0, 5).map(g => g.id))
      const scored = unique.map(m => {
        const genreMatch = m.genre_ids.filter(id => topGenreIds.has(id)).length
        const popNorm = Math.min(m.popularity / 100, 1)
        const rateNorm = (m.vote_average || 0) / 10
        const score = genreMatch * 0.5 + popNorm * 0.3 + rateNorm * 0.2
        return { movie: m, score }
      })

      // Take top 15 by score, then shuffle for variety, pick 9
      scored.sort((a, b) => b.score - a.score)
      const top = scored.slice(0, 15).map(s => s.movie)
      setResults(shuffle(top).slice(0, 9))
    } catch (err) {
      console.error('Recommendations error:', err)
    } finally {
      setLoading(false)
    }
  }, [collection, watchlist, genres])

  // Auto-fetch once when data is ready (re-fetch if collection/watchlist size changes)
  useEffect(() => {
    if (!enabled) return
    if (genres.length === 0 || (collection.length === 0 && watchlist.length === 0)) return
    const key = `${collection.length}-${watchlist.length}`
    if (didFetchRef.current && dataKeyRef.current === key) return
    didFetchRef.current = true
    dataKeyRef.current = key
    refresh()
  }, [enabled, genres.length, collection.length, watchlist.length, refresh])

  return { results, loading, refresh }
}
