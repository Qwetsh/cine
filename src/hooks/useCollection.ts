import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CollectionMovieEntry } from '../types'

export function useCollection(coupleId: string | null) {
  const [entries, setEntries] = useState<CollectionMovieEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCollection = useCallback(async () => {
    if (!coupleId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('collection')
      .select('id, watched_at, rating_user1, rating_user2, note_user1, note_user2, movie:movies(*)')
      .eq('couple_id', coupleId)
      .order('watched_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setEntries(((data as unknown as CollectionMovieEntry[]) ?? []).filter(e => e.movie != null))
    }
    setLoading(false)
  }, [coupleId])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  async function addToCollection(movieId: string): Promise<{ error: string | null }> {
    if (!coupleId) return { error: 'Aucun couple configuré' }
    const { error } = await supabase.from('collection').insert({
      movie_id: movieId,
      couple_id: coupleId,
      watched_at: new Date().toISOString(),
    })
    if (!error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function updateRating(entryId: string, isUser1: boolean, rating: number, note?: string) {
    const updates = isUser1
      ? { rating_user1: rating, note_user1: note ?? null }
      : { rating_user2: rating, note_user2: note ?? null }

    // Optimistic update — apply locally first, no refetch
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e
      return { ...e, ...updates }
    }))

    const { error } = await supabase.from('collection').update(updates).eq('id', entryId)
    if (error) {
      // Revert on failure
      await fetchCollection()
    }
    return { error: error?.message ?? null }
  }

  async function removeFromCollection(entryId: string) {
    // Optimistic remove
    setEntries(prev => prev.filter(e => e.id !== entryId))

    const { error } = await supabase.from('collection').delete().eq('id', entryId)
    if (error) {
      await fetchCollection()
    }
    return { error: error?.message ?? null }
  }

  async function isInCollection(movieDbId: string): Promise<boolean> {
    if (!coupleId) return false
    const { data } = await supabase
      .from('collection')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('movie_id', movieDbId)
      .maybeSingle()
    return !!data
  }

  return { entries, loading, error, addToCollection, updateRating, removeFromCollection, isInCollection, refetch: fetchCollection }
}
