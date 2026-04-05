import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PersonalCollectionEntry } from '../types'

export function usePersonalCollection(userId: string | null) {
  const [entries, setEntries] = useState<PersonalCollectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCollection = useCallback(async () => {
    if (!userId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data, error } = await supabase
      .from('personal_collection')
      .select('id, watched_at, rating, note, movie:movies(*)')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setEntries(((data as unknown as PersonalCollectionEntry[]) ?? []).filter(e => e.movie != null))
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  async function addToPersonalCollection(movieId: string): Promise<{ error: string | null }> {
    if (!userId) return { error: 'Non connecté' }
    const { error } = await supabase.from('personal_collection').insert({
      movie_id: movieId,
      user_id: userId,
      watched_at: new Date().toISOString(),
    })
    if (!error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function updateRating(entryId: string, rating: number, note?: string) {
    // Optimistic update
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e
      return { ...e, rating, note: note ?? e.note }
    }))

    const { error } = await supabase
      .from('personal_collection')
      .update({ rating, note: note ?? null })
      .eq('id', entryId)
    if (error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function removeFromPersonalCollection(entryId: string) {
    // Optimistic remove
    setEntries(prev => prev.filter(e => e.id !== entryId))

    const { error } = await supabase.from('personal_collection').delete().eq('id', entryId)
    if (error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function isInPersonalCollection(movieDbId: string): Promise<boolean> {
    if (!userId) return false
    const { data } = await supabase
      .from('personal_collection')
      .select('id')
      .eq('user_id', userId)
      .eq('movie_id', movieDbId)
      .maybeSingle()
    return !!data
  }

  return { entries, loading, error, addToPersonalCollection, updateRating, removeFromPersonalCollection, isInPersonalCollection, refetch: fetchCollection }
}
