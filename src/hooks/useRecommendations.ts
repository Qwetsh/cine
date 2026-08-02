import { useCallback, useEffect, useRef, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie, TmdbTvShow, TmdbGenre } from '../lib/tmdb'
import { tvToMovie, mediaKey, movieGenresToTv } from '../lib/media'
import type { MediaItem } from '../lib/media'
import type { CollectionMovieEntry, WatchlistMovieEntry, PersonalCollectionEntry, MediaTypeTag } from '../types'

/**
 * Build personalized recommendations from collection + watchlist.
 *
 * Algorithm:
 * 1. Build genre preference profile (weighted by ratings)
 * 2. Discover movies by top genres (random TMDB page for variety)
 * 3. Fetch similar movies for random highly-rated films
 * 4. Optionally discover TV shows by same genres (when includeSeries enabled)
 * 5. Merge, exclude already seen/watchlisted, shuffle, pick 9
 *
 * Les entrées peuvent être mixtes (films + séries normalisées avec media_type).
 */

export type RecommendationItem = MediaItem

type TaggedEntry = { movie: { tmdb_id: number; genres: string[] }; media_type?: MediaTypeTag }

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
  if (rating >= 4.5) return 3
  if (rating >= 3.5) return 2
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
    return best >= 3.5
  })
}

export function useRecommendations(
  collection: (CollectionMovieEntry & { media_type?: MediaTypeTag })[],
  watchlist: (WatchlistMovieEntry & { media_type?: MediaTypeTag })[],
  genres: TmdbGenre[],
  enabled: boolean,
  personalCollection: (PersonalCollectionEntry & { media_type?: MediaTypeTag })[] = [],
  includeSeries = false,
) {
  const [results, setResults] = useState<RecommendationItem[]>([])
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

      // Clés composites à exclure (un film et une série peuvent partager un id TMDB)
      const excludeKeys = new Set<string>()
      const addExclude = (e: TaggedEntry) =>
        excludeKeys.add(mediaKey({ id: e.movie.tmdb_id, media_type: e.media_type }))
      collection.forEach(addExclude)
      watchlist.forEach(addExclude)
      personalCollection.forEach(addExclude)

      const allItems: RecommendationItem[] = []

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
        allItems.push(...d1.results, ...d2.results)
      } else if (topGenres.length === 1) {
        const d = await tmdb.discoverMovies({
          with_genres: String(topGenres[0].id),
          sort_by: 'popularity.desc',
          'vote_count.gte': '50',
          page: randomPage(),
        }).catch(() => ({ results: [] as TmdbMovie[], total_pages: 0 }))
        allItems.push(...d.results)
      }

      // --- Discover TV shows by same genres (when includeSeries enabled) ---
      // Les ids de genres film sont traduits vers le référentiel TV (ids différents)
      if (includeSeries && topGenres.length >= 1) {
        const tvGenreIds = movieGenresToTv(topGenres.slice(0, 2).map(g => g.id))
        if (tvGenreIds.length > 0) {
          const pTv = tmdb.discoverTv({
            with_genres: tvGenreIds.join(','),
            sort_by: 'popularity.desc',
            'vote_count.gte': '50',
            page: randomPage(),
          }).catch(() => ({ results: [] as TmdbTvShow[], total_pages: 0 }))

          const tvResult = await pTv
          allItems.push(...tvResult.results.map(tvToMovie))
        }
      }

      // --- Similar movies from random highly-rated films ---
      // (getSimilar est un endpoint film : on écarte les seeds séries)
      const highRated = getHighRatedMovies(collection.filter(e => e.media_type !== 'tv'))
      if (highRated.length > 0) {
        const seeds = pickRandom(highRated, 3)
        const similarPromises = seeds.map(e =>
          tmdb.getSimilar(e.movie.tmdb_id)
            .then(d => d.results)
            .catch(() => [] as TmdbMovie[])
        )
        const similarResults = await Promise.all(similarPromises)
        for (const movies of similarResults) {
          allItems.push(...movies)
        }
      }

      // --- Merge, deduplicate, exclude, score, shuffle ---
      // Use composite key (media_type + id) to avoid movie/tv ID collisions
      const seen = new Set<string>()
      const unique: RecommendationItem[] = []
      for (const m of allItems) {
        const key = mediaKey(m)
        if (excludeKeys.has(key) || seen.has(key)) continue
        if (!m.poster_path) continue
        seen.add(key)
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
  }, [collection, watchlist, genres, personalCollection, includeSeries])

  // Auto-fetch once when data is ready (re-fetch if collection/watchlist size changes)
  useEffect(() => {
    if (!enabled) return
    if (genres.length === 0 || (collection.length === 0 && watchlist.length === 0)) return
    const key = `${collection.length}-${watchlist.length}-${personalCollection.length}-${includeSeries}`
    if (didFetchRef.current && dataKeyRef.current === key) return
    didFetchRef.current = true
    dataKeyRef.current = key
    refresh()
  }, [enabled, genres.length, collection.length, watchlist.length, personalCollection.length, includeSeries, refresh])

  return { results, loading, refresh }
}
