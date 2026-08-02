import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvWatchlistEntry } from '../types'

// Watchlist séries au niveau série (une entrée = une série).
// season_number est optionnel et purement informatif (« reprendre à la S3 »).
export function useTvWatchlist(coupleId: string | null, userId?: string | null) {
  const [entries, setEntries] = useState<TvWatchlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Garde anti-obsolescence : coupleId se résout après le premier rendu, une
  // réponse du fetch « solo » périmé ne doit pas écraser celle du fetch couple
  const requestIdRef = useRef(0)

  const fetchWatchlist = useCallback(async () => {
    const reqId = ++requestIdRef.current
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
    if (reqId !== requestIdRef.current) return

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
    addedByUserId: string,
    note?: string,
    seasonNumber?: number | null,
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.from('tv_watchlist').insert({
      tv_show_id: tvShowId,
      season_number: seasonNumber ?? null,
      added_by: addedByUserId,
      couple_id: coupleId ?? null,
      note: note ?? null,
    })
    if (!error) await fetchWatchlist()
    // 23505 : la série est déjà dans la watchlist (index unique partiel) — pas une erreur
    if (error && error.code === '23505') return { error: null }
    return { error: error?.message ?? null }
  }

  async function removeFromTvWatchlist(entryId: string) {
    setEntries(prev => prev.filter(e => e.id !== entryId))
    const { error } = await supabase.from('tv_watchlist').delete().eq('id', entryId)
    if (error) await fetchWatchlist()
    return { error: error?.message ?? null }
  }

  async function isInTvWatchlist(tvShowId: string): Promise<boolean> {
    if (!coupleId && !userId) return false
    let query = supabase
      .from('tv_watchlist')
      .select('id')
      .eq('tv_show_id', tvShowId)

    if (coupleId) {
      query = query.eq('couple_id', coupleId)
    } else {
      query = query.is('couple_id', null).eq('added_by', userId!)
    }

    const { data } = await query.limit(1).maybeSingle()
    return !!data
  }

  return {
    entries,
    loading,
    error,
    addToTvWatchlist,
    removeFromTvWatchlist,
    isInTvWatchlist,
    refetch: fetchWatchlist,
  }
}
