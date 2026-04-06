import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WatchlistMovieEntry } from '../types'

export function useWatchlist(coupleId: string | null) {
  const [entries, setEntries] = useState<WatchlistMovieEntry[]>([])
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
      .from('watchlist')
      .select('id, added_by, note, created_at, movie:movies(*)')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setEntries((data as unknown as WatchlistMovieEntry[] ?? []).filter(e => e.movie != null))
    }
    setLoading(false)
  }, [coupleId])

  useEffect(() => { fetchWatchlist() }, [fetchWatchlist])

  async function addToWatchlist(movieId: string, userId: string, note?: string) {
    if (!coupleId) return { error: 'Aucun couple configuré' }
    const { error } = await supabase.from('watchlist').insert({
      movie_id: movieId,
      added_by: userId,
      couple_id: coupleId,
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
    if (!coupleId) return false
    const { data } = await supabase
      .from('watchlist')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('movie_id', movieDbId)
      .maybeSingle()
    return !!data
  }

  return { entries, loading, error, addToWatchlist, removeFromWatchlist, isInWatchlist, refetch: fetchWatchlist }
}
