import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvPersonalCollectionEntry } from '../types'

// Collection séries perso — miroir de usePersonalCollection (films).
export function useTvPersonalCollection(userId: string | null) {
  const [entries, setEntries] = useState<TvPersonalCollectionEntry[]>([])
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
      .from('tv_personal_collection')
      .select('id, watched_at, rating, note, emoji, tv_show:tv_shows(*)')
      .eq('user_id', userId)
      .order('watched_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setEntries(
        (data as unknown as TvPersonalCollectionEntry[] ?? []).filter(e => e.tv_show != null)
      )
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  async function addToTvPersonalCollection(tvShowId: string, extras?: {
    rating?: number | null
    note?: string | null
    emoji?: string | null
  }): Promise<{ error: string | null }> {
    if (!userId) return { error: 'Non connecté' }
    const { error } = await supabase.from('tv_personal_collection').insert({
      tv_show_id: tvShowId,
      user_id: userId,
      watched_at: new Date().toISOString(),
      ...extras,
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
    // Optimistic update — la note texte n'est modifiée que si fournie
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, rating, ...(note !== undefined ? { note } : {}) } : e
    ))
    const updates: Record<string, unknown> = { rating }
    if (note !== undefined) updates.note = note
    const { error } = await supabase
      .from('tv_personal_collection')
      .update(updates)
      .eq('id', entryId)
    if (error) await fetchCollection()
  }

  async function updateEmoji(entryId: string, emoji: string | null) {
    setEntries(prev => prev.map(e => e.id !== entryId ? e : { ...e, emoji }))
    const { error } = await supabase.from('tv_personal_collection').update({ emoji }).eq('id', entryId)
    if (error) await fetchCollection()
  }

  async function isInTvPersonalCollection(tvShowId: string): Promise<boolean> {
    if (!userId) return false
    const { data } = await supabase
      .from('tv_personal_collection')
      .select('id')
      .eq('user_id', userId)
      .eq('tv_show_id', tvShowId)
      .maybeSingle()
    return !!data
  }

  return {
    entries,
    loading,
    error,
    addToTvPersonalCollection,
    removeFromTvPersonalCollection,
    updateRating,
    updateEmoji,
    isInTvPersonalCollection,
    refetch: fetchCollection,
  }
}
