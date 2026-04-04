import { useCallback, useRef, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../lib/tmdb'
import type { Preferences } from './usePreferences'
import { useSettings, getStreamingDiscoverParams } from './useSettings'

export type FeedbackType = 'too_old' | 'too_recent' | 'not_this_genre' | 'exclude_genre' | 'same_genre_diff_movie' | 'accept'

interface SessionState {
  excludedMovieIds: Set<number>
  excludedGenreIds: Set<number>
  preferredGenreIds: Set<number>
  yearMin: number
  yearMax: number
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function genreNameToId(name: string, genres: TmdbGenre[]): number | null {
  const g = genres.find(g => g.name.toLowerCase() === name.toLowerCase())
  return g?.id ?? null
}

export function useSmartSuggestion(preferences: Preferences, tmdbGenres: TmdbGenre[]) {
  const [suggestion, setSuggestion] = useState<TmdbMovie | null>(null)
  const [loading, setLoading] = useState(false)
  const [noMoreResults, setNoMoreResults] = useState(false)
  const sessionRef = useRef<SessionState | null>(null)
  const { settings } = useSettings()

  const currentYear = new Date().getFullYear()

  function getOrInitSession(): SessionState {
    if (!sessionRef.current) {
      // Convert preference genre names to IDs
      const preferredIds = new Set<number>()
      for (const name of preferences.topGenres.slice(0, 5)) {
        const id = genreNameToId(name, tmdbGenres)
        if (id) preferredIds.add(id)
      }

      sessionRef.current = {
        excludedMovieIds: new Set(),
        excludedGenreIds: new Set(),
        preferredGenreIds: preferredIds,
        yearMin: Math.max(preferences.yearRange[0] - 5, 1920),
        yearMax: Math.min(preferences.yearRange[1] + 5, currentYear),
      }
    }
    return sessionRef.current
  }

  const suggest = useCallback(async () => {
    setLoading(true)
    setNoMoreResults(false)

    try {
      const session = getOrInitSession()

      // Pick genres: from preferred minus excluded
      const availableGenres = [...session.preferredGenreIds].filter(
        id => !session.excludedGenreIds.has(id)
      )

      // If no preferred genres left, use any non-excluded
      const genrePool = availableGenres.length > 0
        ? availableGenres
        : tmdbGenres
          .map(g => g.id)
          .filter(id => !session.excludedGenreIds.has(id))

      // Pick 1-2 random genres for variety
      const selectedGenres: number[] = []
      if (genrePool.length > 0) {
        selectedGenres.push(pickRandom(genrePool))
        if (genrePool.length > 1 && Math.random() > 0.5) {
          const second = pickRandom(genrePool.filter(g => g !== selectedGenres[0]))
          if (second) selectedGenres.push(second)
        }
      }

      // Random page (1-5) for variety
      const page = Math.floor(Math.random() * 5) + 1

      // Lower vote threshold for older films (fewer votes on TMDB)
      const voteThreshold = session.yearMax < 1990 ? '10' : session.yearMax < 2000 ? '30' : '50'

      const params: Record<string, string | number | undefined> = {
        'vote_count.gte': voteThreshold,
        'vote_average.gte': '6',
        sort_by: 'popularity.desc',
        page,
        'primary_release_date.gte': `${session.yearMin}-01-01`,
        'primary_release_date.lte': `${session.yearMax}-12-31`,
      }

      if (selectedGenres.length > 0) {
        params.with_genres = selectedGenres.join(',')
      }

      // Apply streaming platform filter from user settings
      const streamingParams = getStreamingDiscoverParams(settings)
      Object.assign(params, streamingParams)

      const data = await tmdb.discoverMovies(params)

      // Filter out already excluded movies
      const candidates = data.results.filter(
        m => !session.excludedMovieIds.has(m.id)
      )

      if (candidates.length === 0) {
        // Try page 1 as fallback
        if (page !== 1) {
          params.page = 1
          const fallback = await tmdb.discoverMovies(params)
          const fallbackCandidates = fallback.results.filter(
            m => !session.excludedMovieIds.has(m.id)
          )
          if (fallbackCandidates.length > 0) {
            const pick = pickRandom(fallbackCandidates)
            session.excludedMovieIds.add(pick.id)
            setSuggestion(pick)
            return
          }
        }
        setNoMoreResults(true)
        setSuggestion(null)
        return
      }

      const pick = pickRandom(candidates)
      session.excludedMovieIds.add(pick.id)
      setSuggestion(pick)
    } catch (err) {
      console.error('Suggestion error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, tmdbGenres])

  const giveFeedback = useCallback((type: FeedbackType, movie: TmdbMovie, genreId?: number) => {
    const session = getOrInitSession()

    switch (type) {
      case 'too_old':
        // Shift year range forward, keep a 20-year window
        session.yearMin = Math.min(session.yearMin + 10, currentYear - 5)
        if (session.yearMax < session.yearMin + 10) {
          session.yearMax = Math.min(session.yearMin + 20, currentYear)
        }
        break
      case 'too_recent':
        // Shift year range backward, keep a 20-year window
        session.yearMax = Math.max(session.yearMax - 10, 1930)
        session.yearMin = Math.min(session.yearMin, session.yearMax - 20)
        if (session.yearMin < 1920) session.yearMin = 1920
        break
      case 'exclude_genre':
        // Exclude one specific genre
        if (genreId != null) {
          session.excludedGenreIds.add(genreId)
          session.preferredGenreIds.delete(genreId)
        }
        break
      case 'not_this_genre':
        // Exclude all genres of this movie
        for (const gId of movie.genre_ids) {
          session.excludedGenreIds.add(gId)
          session.preferredGenreIds.delete(gId)
        }
        break
      case 'same_genre_diff_movie':
        // Keep genres, just exclude this specific movie (already done)
        // Lock in these genres as preferred for next pick
        session.preferredGenreIds.clear()
        for (const gId of movie.genre_ids) {
          if (!session.excludedGenreIds.has(gId)) {
            session.preferredGenreIds.add(gId)
          }
        }
        break
      case 'accept':
        // Nothing to adjust
        break
    }

    // Then suggest next (except accept)
    if (type !== 'accept') {
      suggest()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest])

  const reset = useCallback(() => {
    sessionRef.current = null
    setSuggestion(null)
    setNoMoreResults(false)
  }, [])

  return { suggestion, loading, noMoreResults, suggest, giveFeedback, reset }
}
