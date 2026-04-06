import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvPersonalCollectionEntry } from '../types'

export function useTvPersonalCollection(userId: string | null) {
  const [entries, setEntries] = useState<TvPersonalCollectionEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCollection = useCallback(async () => {
    if (!userId) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('tv_personal_collection')
      .select('id, watched_at, rating, note, tv_show:tv_shows(*)')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })

    if (!error && data) {
      setEntries(
        (data as unknown as TvPersonalCollectionEntry[] ?? []).filter(e => e.tv_show != null)
      )
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  async function addToTvPersonalCollection(tvShowId: string): Promise<{ error: string | null }> {
    if (!userId) return { error: 'Non connecté' }
    const { error } = await supabase.from('tv_personal_collection').insert({
      tv_show_id: tvShowId,
      user_id: userId,
      watched_at: new Date().toISOString(),
    })
    if (!error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function removeFromTvPersonalCollection(entryId: string) {
    setEntries(prev => prev.filter(e => e.id !== entryId))
    const { error } = await supabase.from('tv_personal_collection').delete().eq('id', entryId)
    if (error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function updateRating(entryId: string, rating: number, note?: string) {
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, rating, note: note ?? e.note } : e
    ))
    const { error } = await supabase
      .from('tv_personal_collection')
      .update({ rating, note: note ?? null })
      .eq('id', entryId)
    if (error) await fetchCollection()
  }

  return {
    entries,
    loading,
    addToTvPersonalCollection,
    removeFromTvPersonalCollection,
    updateRating,
    refetch: fetchCollection,
  }
}
