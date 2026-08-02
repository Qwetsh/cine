import { useCallback, useRef, useState } from 'react'
import { tmdb } from '../lib/tmdb'
import { tvToMovie, mediaKey, movieGenresToTv } from '../lib/media'
import type { MediaItem } from '../lib/media'
import type { TmdbGenre } from '../lib/tmdb'
import type { Preferences } from './usePreferences'
import { useSettings, getStreamingDiscoverParams } from './useSettings'

export type FeedbackType = 'too_old' | 'too_recent' | 'not_this_genre' | 'exclude_genre' | 'same_genre_diff_movie' | 'accept'

interface SessionState {
  excludedKeys: Set<string> // mediaKey — un film et une série peuvent partager un id
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

export function useSmartSuggestion(preferences: Preferences, tmdbGenres: TmdbGenre[], includeSeries = false) {
  const [suggestion, setSuggestion] = useState<MediaItem | null>(null)
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
        excludedKeys: new Set(),
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

      // ~30 % de séries dans le flux quand elles sont activées
      const tvGenreIds = movieGenresToTv(selectedGenres)
      const suggestTv = includeSeries && Math.random() < 0.3 && (selectedGenres.length === 0 || tvGenreIds.length > 0)

      const params: Record<string, string | number | undefined> = {
        'vote_count.gte': voteThreshold,
        'vote_average.gte': '6',
        sort_by: 'popularity.desc',
        page,
      }
      if (suggestTv) {
        params['first_air_date.gte'] = `${session.yearMin}-01-01`
        params['first_air_date.lte'] = `${session.yearMax}-12-31`
        if (tvGenreIds.length > 0) params.with_genres = tvGenreIds.join(',')
      } else {
        params['primary_release_date.gte'] = `${session.yearMin}-01-01`
        params['primary_release_date.lte'] = `${session.yearMax}-12-31`
        if (selectedGenres.length > 0) params.with_genres = selectedGenres.join(',')
      }

      // Apply streaming platform filter from user settings
      const streamingParams = getStreamingDiscoverParams(settings)
      Object.assign(params, streamingParams)

      const fetchCandidates = async (p: Record<string, string | number | undefined>): Promise<MediaItem[]> => {
        const items: MediaItem[] = suggestTv
          ? (await tmdb.discoverTv(p)).results.map(tvToMovie)
          : (await tmdb.discoverMovies(p)).results.map(m => ({ ...m, media_type: 'movie' as const }))
        return items.filter(
          m => !session.excludedKeys.has(mediaKey(m)) &&
               !m.genre_ids.some(gId => session.excludedGenreIds.has(gId))
        )
      }

      const candidates = await fetchCandidates(params)

      if (candidates.length === 0) {
        // Try page 1 as fallback
        if (page !== 1) {
          const fallbackCandidates = await fetchCandidates({ ...params, page: 1 })
          if (fallbackCandidates.length > 0) {
            const pick = pickRandom(fallbackCandidates)
            session.excludedKeys.add(mediaKey(pick))
            setSuggestion(pick)
            return
          }
        }
        setNoMoreResults(true)
        setSuggestion(null)
        return
      }

      const pick = pickRandom(candidates)
      session.excludedKeys.add(mediaKey(pick))
      setSuggestion(pick)
    } catch (err) {
      console.error('Suggestion error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, tmdbGenres, includeSeries])

  const giveFeedback = useCallback((type: FeedbackType, movie: MediaItem, genreId?: number) => {
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
