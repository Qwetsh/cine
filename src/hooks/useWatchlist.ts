import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WatchlistMovieEntry } from '../types'

export function useWatchlist(coupleId: string | null, userId?: string | null) {
  const [entries, setEntries] = useState<WatchlistMovieEntry[]>([])
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
      .from('watchlist')
      .select('id, added_by, note, created_at, movie:movies(*)')
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
      setEntries((data as unknown as WatchlistMovieEntry[] ?? []).filter(e => e.movie != null))
    }
    setLoading(false)
  }, [coupleId, userId])

  useEffect(() => { fetchWatchlist() }, [fetchWatchlist])

  async function addToWatchlist(movieId: string, addedByUserId: string, note?: string) {
    const { error } = await supabase.from('watchlist').insert({
      movie_id: movieId,
      added_by: addedByUserId,
      couple_id: coupleId ?? null,
      note: note ?? null,
    })
    if (!error) await fetchWatchlist()
    return { error: error?.message ?? null }
  }

  async function removeFromWatchlist(entryId: string) {
    const { error } = await supabase.from('watchlist').delete().eq('id', entryId)
    if (!error) await fetchWatchlist()
    return { error: error?.message ?? null }
  }

  async function isInWatchlist(movieDbId: string): Promise<boolean> {
    if (!coupleId && !userId) return false
    let query = supabase
      .from('watchlist')
      .select('id')
      .eq('movie_id', movieDbId)

    if (coupleId) {
      query = query.eq('couple_id', coupleId)
    } else {
      query = query.is('couple_id', null).eq('added_by', userId!)
    }

    const { data } = await query.maybeSingle()
    return !!data
  }

  return { entries, loading, error, addToWatchlist, removeFromWatchlist, isInWatchlist, refetch: fetchWatchlist }
}
