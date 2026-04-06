import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvWatchlistEntry } from '../types'

export function useTvWatchlist(coupleId: string | null, userId?: string | null) {
  const [entries, setEntries] = useState<TvWatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWatchlist = useCallback(async () => {
    if (!coupleId && !userId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    let query = supabase
      .from('tv_watchlist')
      .select('id, season_number, added_by, note, created_at, tv_show:tv_shows(*)')
      .order('created_at', { ascending: false })

    if (coupleId) {
      query = query.eq('couple_id', coupleId)
    } else {
      query = query.is('couple_id', null).eq('added_by', userId!)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
    } else {
      setEntries(
        (data as unknown as TvWatchlistEntry[] ?? []).filter(e => e.tv_show != null)
      )
    }
    setLoading(false)
  }, [coupleId, userId])

  useEffect(() => { fetchWatchlist() }, [fetchWatchlist])

  async function addToTvWatchlist(
    tvShowId: string,
    seasonNumber: number,
    addedByUserId: string,
    note?: string,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.from('tv_watchlist').insert({
      tv_show_id: tvShowId,
      season_number: seasonNumber,
      added_by: addedByUserId,
      couple_id: coupleId ?? null,
      note: note ?? null,
    })
    if (!error) await fetchWatchlist()
    return { error: error?.message ?? null }
  }

  async function removeFromTvWatchlist(entryId: string) {
    setEntries(prev => prev.filter(e => e.id !== entryId))
    const { error } = await supabase.from('tv_watchlist').delete().eq('id', entryId)
    if (error) await fetchWatchlist()
    return { error: error?.message ?? null }
  }

  async function isSeasonInWatchlist(tvShowId: string, seasonNumber: number): Promise<boolean> {
    if (!coupleId && !userId) return false
    let query = supabase
      .from('tv_watchlist')
      .select('id')
      .eq('tv_show_id', tvShowId)
      .eq('season_number', seasonNumber)

    if (coupleId) {
      query = query.eq('couple_id', coupleId)
    } else {
      query = query.is('couple_id', null).eq('added_by', userId!)
    }

    const { data } = await query.maybeSingle()
    return !!data
  }

  return {
    entries,
    loading,
    error,
    addToTvWatchlist,
    removeFromTvWatchlist,
    isSeasonInWatchlist,
    refetch: fetchWatchlist,
  }
}
