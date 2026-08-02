import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvCollectionEntry } from '../types'

// Collection séries du couple — miroir de useCollection (films) :
// notes, avis et emojis par membre du couple, date de visionnage.
export function useTvCollection(coupleId: string | null) {
  const [entries, setEntries] = useState<TvCollectionEntry[]>([])
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
      .from('tv_collection')
      .select('id, created_at, watched_at, rating_user1, rating_user2, note_user1, note_user2, emoji_user1, emoji_user2, tv_show:tv_shows(*)')
      .eq('couple_id', coupleId)
      .order('watched_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setEntries(
        (data as unknown as TvCollectionEntry[] ?? []).filter(e => e.tv_show != null)
      )
    }
    setLoading(false)
  }, [coupleId])

  useEffect(() => { fetchCollection() }, [fetchCollection])

  async function addToTvCollection(tvShowId: string, extras?: {
    rating_user1?: number | null
    rating_user2?: number | null
    note_user1?: string | null
    note_user2?: string | null
    emoji_user1?: string | null
    emoji_user2?: string | null
  }): Promise<{ error: string | null }> {
    if (!coupleId) return { error: 'Aucun couple configuré' }
    const { error } = await supabase.from('tv_collection').insert({
      tv_show_id: tvShowId,
      couple_id: coupleId,
      watched_at: new Date().toISOString(),
      ...extras,
    })
    if (!error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function updateRating(entryId: string, isUser1: boolean, rating: number, note?: string) {
    const ratingField = isUser1 ? 'rating_user1' : 'rating_user2'
    const noteField = isUser1 ? 'note_user1' : 'note_user2'

    const updates: Record<string, unknown> = { [ratingField]: rating }
    if (note !== undefined) updates[noteField] = note

    // Optimistic update — apply locally first, no refetch
    setEntries(prev => prev.map(e => {
      if (e.id !== entryId) return e
      const optimistic: Record<string, unknown> = { [ratingField]: rating }
      if (note !== undefined) optimistic[noteField] = note
      return { ...e, ...optimistic }
    }))

    const { error } = await supabase.from('tv_collection').update(updates).eq('id', entryId)
    if (error) {
      await fetchCollection()
    }
    return { error: error?.message ?? null }
  }

  async function updateEmoji(entryId: string, isUser1: boolean, emoji: string | null) {
    const updates = isUser1 ? { emoji_user1: emoji } : { emoji_user2: emoji }
    setEntries(prev => prev.map(e => e.id !== entryId ? e : { ...e, ...updates }))
    const { error } = await supabase.from('tv_collection').update(updates).eq('id', entryId)
    if (error) await fetchCollection()
  }

  async function removeFromTvCollection(entryId: string) {
    setEntries(prev => prev.filter(e => e.id !== entryId))
    const { error } = await supabase.from('tv_collection').delete().eq('id', entryId)
    if (error) await fetchCollection()
    return { error: error?.message ?? null }
  }

  async function isInTvCollection(tvShowId: string): Promise<boolean> {
    if (!coupleId) return false
    const { data } = await supabase
      .from('tv_collection')
      .select('id')
      .eq('couple_id', coupleId)
      .eq('tv_show_id', tvShowId)
      .maybeSingle()
    return !!data
  }

  return {
    entries,
    loading,
    error,
    addToTvCollection,
    updateRating,
    updateEmoji,
    removeFromTvCollection,
    isInTvCollection,
    refetch: fetchCollection,
  }
}
