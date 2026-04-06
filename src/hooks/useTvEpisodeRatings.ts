import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvEpisodeRatingEntry } from '../types'

export function useTvEpisodeRatings(tvShowId: string | null, coupleId: string | null) {
  const [ratings, setRatings] = useState<TvEpisodeRatingEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRatings = useCallback(async () => {
    if (!tvShowId || !coupleId) {
      setRatings([])
      setLoading(false)
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('tv_episode_ratings')
      .select('id, tv_show_id, season_number, episode_number, rating_user1, rating_user2, note_user1, note_user2, watched_at')
      .eq('tv_show_id', tvShowId)
      .eq('couple_id', coupleId)
      .order('season_number')
      .order('episode_number')

    if (!error && data) {
      setRatings(data as TvEpisodeRatingEntry[])
    }
    setLoading(false)
  }, [tvShowId, coupleId])

  useEffect(() => { fetchRatings() }, [fetchRatings])

  async function rateEpisode(
    seasonNumber: number,
    episodeNumber: number,
    isUser1: boolean,
    rating: number,
    note?: string,
  ) {
    if (!tvShowId || !coupleId) return { error: 'Pas de contexte' }

    const ratingField = isUser1 ? 'rating_user1' : 'rating_user2'
    const noteField = isUser1 ? 'note_user1' : 'note_user2'

    // Optimistic update
    setRatings(prev => {
      const existing = prev.find(
        r => r.season_number === seasonNumber && r.episode_number === episodeNumber
      )
      if (existing) {
        return prev.map(r =>
          r.id === existing.id
            ? { ...r, [ratingField]: rating, [noteField]: note ?? r[noteField] }
            : r
        )
      }
      // New entry — add optimistically with temp id
      return [...prev, {
        id: `temp-${seasonNumber}-${episodeNumber}`,
        tv_show_id: tvShowId,
        season_number: seasonNumber,
        episode_number: episodeNumber,
        rating_user1: isUser1 ? rating : null,
        rating_user2: isUser1 ? null : rating,
        note_user1: isUser1 ? (note ?? null) : null,
        note_user2: isUser1 ? null : (note ?? null),
        watched_at: new Date().toISOString(),
      }]
    })

    // Upsert to Supabase
    const { error } = await supabase
      .from('tv_episode_ratings')
      .upsert(
        {
          tv_show_id: tvShowId,
          season_number: seasonNumber,
          episode_number: episodeNumber,
          couple_id: coupleId,
          [ratingField]: rating,
          [noteField]: note ?? null,
        },
        { onConflict: 'tv_show_id,season_number,episode_number,couple_id' }
      )

    if (error) {
      await fetchRatings() // revert on error
    } else {
      // Refetch to get real IDs
      await fetchRatings()
    }
    return { error: error?.message ?? null }
  }

  // --- Computed averages ---

  function getEpisodeRating(seasonNumber: number, episodeNumber: number): TvEpisodeRatingEntry | undefined {
    return ratings.find(r => r.season_number === seasonNumber && r.episode_number === episodeNumber)
  }

  function getSeasonRatings(seasonNumber: number): TvEpisodeRatingEntry[] {
    return ratings.filter(r => r.season_number === seasonNumber)
  }

  function getSeasonAvg(seasonNumber: number): number | null {
    const seasonRatings = getSeasonRatings(seasonNumber)
    if (seasonRatings.length === 0) return null

    const values: number[] = []
    for (const r of seasonRatings) {
      const avg = computeEntryAvg(r)
      if (avg !== null) values.push(avg)
    }
    if (values.length === 0) return null
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
  }

  function getSeriesAvg(): number | null {
    const seasonNumbers = [...new Set(ratings.map(r => r.season_number))]
    const avgs: number[] = []
    for (const sn of seasonNumbers) {
      const avg = getSeasonAvg(sn)
      if (avg !== null) avgs.push(avg)
    }
    if (avgs.length === 0) return null
    return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10
  }

  function getRatedSeasonsCount(): number {
    const seasonNumbers = [...new Set(ratings.map(r => r.season_number))]
    return seasonNumbers.filter(sn => getSeasonAvg(sn) !== null).length
  }

  return {
    ratings,
    loading,
    rateEpisode,
    getEpisodeRating,
    getSeasonRatings,
    getSeasonAvg,
    getSeriesAvg,
    getRatedSeasonsCount,
    refetch: fetchRatings,
  }
}

function computeEntryAvg(r: TvEpisodeRatingEntry): number | null {
  if (r.rating_user1 != null && r.rating_user2 != null) {
    return (r.rating_user1 + r.rating_user2) / 2
  }
  return r.rating_user1 ?? r.rating_user2 ?? null
}
