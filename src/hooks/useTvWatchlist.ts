import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvWatchlistEntry } from '../types'

export function useTvWatchlist(coupleId: string | null) {
  const [entries, setEntries] = useState<TvWatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWatchlist = useCallback(async () => {
    if (!coupleId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('tv_watchlist')
      .select('id, season_number, added_by, note, created_at, tv_show:tv_shows(*)')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setEntries(
        ((data as unknown as TvWatchlistEntry[]) ?? []).filter(e => e.tv_show != null)
      )
    }
    setLoading(false)
  }, [coupleId])

  useEffect(() => { fetchWatchlist() }, [fetchWatchlist])

  async function addToTvWatchlist(
    tvShowId: string,
    seasonNumber: number,
    userId: string,
    note?: string,
  ): Promise<{ error: string | null }> {
    if (!coupleId) return { error: 'Aucun couple configuré' }
    const { error } = await supabase.from('tv_watchlist').insert({
      tv_show_id: tvShowId,
      season_number: seasonNumber,
      added_by: userId,
      couple_id: coupleId,
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
    if (!coupleId) return false
    const { data } = await supabase
      .from('tv_watchlist')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('tv_show_id', tvShowId)
      .eq('season_number', seasonNumber)
      .maybeSingle()
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
