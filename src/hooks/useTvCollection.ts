import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TvCollectionEntry } from '../types'

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
      .select('id, created_at, tv_show:tv_shows(*)')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })

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

  async function addToTvCollection(tvShowId: string): Promise<{ error: string | null }> {
    if (!coupleId) return { error: 'Aucun couple configuré' }
    const { error } = await supabase.from('tv_collection').insert({
      tv_show_id: tvShowId,
      couple_id: coupleId,
    })
    if (!error) await fetchCollection()
    return { error: error?.message ?? null }
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
    removeFromTvCollection,
    isInTvCollection,
    refetch: fetchCollection,
  }
}
