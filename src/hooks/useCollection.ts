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
      .select(`
        id, watched_at, rating_user1, rating_user2, note_user1, note_user2,
        movie:movies(*)
      `)
      .eq('couple_id', coupleId)
      .order('watched_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setEntries((data as unknown as CollectionMovieEntry[]) ?? [])
    }
    setLoading(false)
  }, [coupleId])

  useEffect(() => {
    fetchCollection()
  }, [fetchCollection])

  async function addToCollection(params: {
    movieId: string
    watchedAt?: string
    ratingUser1?: number
    ratingUser2?: number
    noteUser1?: string
    noteUser2?: string
  }) {
    if (!coupleId) return { error: 'Aucun couple configuré' }

    const { error } = await supabase.from('collection').insert({
      movie_id: params.movieId,
      couple_id: coupleId,
      watched_at: params.watchedAt ?? new Date().toISOString(),
      rating_user1: params.ratingUser1 ?? null,
      rating_user2: params.ratingUser2 ?? null,
      note_user1: params.noteUser1 ?? null,
      note_user2: params.noteUser2 ?? null,
    })

    if (!error) await fetchCollection()
    return { error }
  }

  async function updateRating(entryId: string, isUser1: boolean, rating: number, note?: string) {
    const updates = isUser1
      ? { rating_user1: rating, note_user1: note }
      : { rating_user2: rating, note_user2: note }

    const { error } = await supabase.from('collection').update(updates).eq('id', entryId)
    if (!error) await fetchCollection()
    return { error }
  }

  return { entries, loading, error, addToCollection, updateRating, refetch: fetchCollection }
}
