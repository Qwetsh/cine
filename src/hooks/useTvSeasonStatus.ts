import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvSeasonStatusEntry } from '../types'

export function useTvSeasonStatus(
  tvShowId: string | null,
  coupleId: string | null,
  userId: string | null,
) {
  const [statuses, setStatuses] = useState<TvSeasonStatusEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchStatuses = useCallback(async () => {
    if (!tvShowId) {
      setStatuses([])
      setLoading(false)
      return
    }
    setLoading(true)

    // Fetch both couple and solo statuses for this show
    let query = supabase
      .from('tv_season_status')
      .select('id, tv_show_id, season_number, couple_id, user_id, watched_type')
      .eq('tv_show_id', tvShowId)

    if (coupleId) {
      // Get couple statuses + user's solo statuses
      query = query.or(`couple_id.eq.${coupleId},user_id.eq.${userId}`)
    } else if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (!error && data) {
      setStatuses(data as TvSeasonStatusEntry[])
    }
    setLoading(false)
  }, [tvShowId, coupleId, userId])

  useEffect(() => { fetchStatuses() }, [fetchStatuses])

  function getSeasonStatus(seasonNumber: number): TvSeasonStatusEntry | undefined {
    return statuses.find(s => s.season_number === seasonNumber)
  }

  async function markSeason(
    seasonNumber: number,
    watchedType: 'couple' | 'solo',
  ) {
    if (!tvShowId) return { error: 'Pas de série' }

    const payload: Record<string, unknown> = {
      tv_show_id: tvShowId,
      season_number: seasonNumber,
      watched_type: watchedType,
    }

    if (watchedType === 'couple' && coupleId) {
      payload.couple_id = coupleId
      payload.user_id = null
    } else if (userId) {
      payload.user_id = userId
      payload.couple_id = null
    }

    // Remove existing status for this season first
    const existing = getSeasonStatus(seasonNumber)
    if (existing) {
      await supabase.from('tv_season_status').delete().eq('id', existing.id)
    }

    const { error } = await supabase.from('tv_season_status').insert(payload)
    if (!error) await fetchStatuses()
    return { error: error?.message ?? null }
  }

  async function unmarkSeason(seasonNumber: number) {
    const existing = getSeasonStatus(seasonNumber)
    if (!existing) return { error: null }

    setStatuses(prev => prev.filter(s => s.id !== existing.id))
    const { error } = await supabase.from('tv_season_status').delete().eq('id', existing.id)
    if (error) await fetchStatuses()
    return { error: error?.message ?? null }
  }

  return {
    statuses,
    loading,
    getSeasonStatus,
    markSeason,
    unmarkSeason,
    refetch: fetchStatuses,
  }
}
