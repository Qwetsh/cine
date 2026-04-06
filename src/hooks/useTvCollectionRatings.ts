import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvEpisodeRatingEntry } from '../types'

interface ShowAvg {
  user1: number | null
  user2: number | null
}

export function useTvCollectionRatings(coupleId: string | null) {
  const [ratings, setRatings] = useState<TvEpisodeRatingEntry[]>([])

  const fetchAll = useCallback(async () => {
    if (!coupleId) { setRatings([]); return }
    const { data } = await supabase
      .from('tv_episode_ratings')
      .select('id, tv_show_id, season_number, episode_number, rating_user1, rating_user2, note_user1, note_user2, watched_at')
      .eq('couple_id', coupleId)
    if (data) setRatings(data as TvEpisodeRatingEntry[])
  }, [coupleId])

  useEffect(() => { fetchAll() }, [fetchAll])

  function getShowAvg(tvShowId: string): ShowAvg {
    const showRatings = ratings.filter(r => r.tv_show_id === tvShowId)
    if (showRatings.length === 0) return { user1: null, user2: null }

    const u1Vals = showRatings.map(r => r.rating_user1).filter((v): v is number => v != null)
    const u2Vals = showRatings.map(r => r.rating_user2).filter((v): v is number => v != null)

    return {
      user1: u1Vals.length > 0 ? Math.round((u1Vals.reduce((a, b) => a + b, 0) / u1Vals.length) * 10) / 10 : null,
      user2: u2Vals.length > 0 ? Math.round((u2Vals.reduce((a, b) => a + b, 0) / u2Vals.length) * 10) / 10 : null,
    }
  }

  return { getShowAvg, refetch: fetchAll }
}
