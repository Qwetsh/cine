import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Recommendation } from '../types'

export interface UseFriendRecosState {
  sent: Recommendation[]
  received: Recommendation[]
  unseenCount: number
  loading: boolean
  error: string | null
  sendRecommendation: (toUserIds: string[], movieId: number | null, tvShowId: number | null, message?: string) => Promise<{ error: string | null }>
  deleteRecommendation: (recoId: string) => Promise<void>
  markAllSeen: () => Promise<void>
  refetch: () => Promise<void>
}

export function useFriendRecos(userId: string | null): UseFriendRecosState {
  const [sent, setSent] = useState<Recommendation[]>([])
  const [received, setReceived] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecos = useCallback(async () => {
    if (!userId) {
      setSent([])
      setReceived([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const [sentRes, receivedRes] = await Promise.all([
      supabase
        .from('recommendations')
        .select('*')
        .eq('from_user_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('recommendations')
        .select('*')
        .eq('to_user_id', userId)
        .order('created_at', { ascending: false }),
    ])

    if (sentRes.error || receivedRes.error) {
      setError(sentRes.error?.message ?? receivedRes.error?.message ?? 'Erreur')
    } else {
      setSent((sentRes.data ?? []) as unknown as Recommendation[])
      setReceived((receivedRes.data ?? []) as unknown as Recommendation[])
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchRecos()
  }, [fetchRecos])

  const unseenCount = received.filter(r => r.seen_at === null).length

  async function sendRecommendation(
    toUserIds: string[],
    movieId: number | null,
    tvShowId: number | null,
    message?: string,
  ): Promise<{ error: string | null }> {
    if (!userId) return { error: 'Non connecté' }

    const rows = toUserIds.map(toId => ({
      from_user_id: userId,
      to_user_id: toId,
      movie_id: movieId,
      tv_show_id: tvShowId,
      message: message || null,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('recommendations')
      .insert(rows)
      .select()

    if (insertError) return { error: insertError.message }

    // Optimistic add
    const newRecos = (inserted ?? []) as unknown as Recommendation[]
    setSent(prev => [...newRecos, ...prev])

    return { error: null }
  }

  async function markAllSeen(): Promise<void> {
    if (!userId) return

    const unseenIds = received.filter(r => r.seen_at === null).map(r => r.id)
    if (unseenIds.length === 0) return

    // Optimistic update
    const now = new Date().toISOString()
    setReceived(prev =>
      prev.map(r => r.seen_at === null ? { ...r, seen_at: now } : r)
    )

    const { error: updateError } = await supabase
      .from('recommendations')
      .update({ seen_at: now })
      .in('id', unseenIds)

    if (updateError) {
      await fetchRecos()
    }
  }

  async function deleteRecommendation(recoId: string): Promise<void> {
    // Optimistic remove from both lists
    setReceived(prev => prev.filter(r => r.id !== recoId))
    setSent(prev => prev.filter(r => r.id !== recoId))

    const { error: deleteError } = await supabase
      .from('recommendations')
      .delete()
      .eq('id', recoId)

    if (deleteError) {
      await fetchRecos()
    }
  }

  return {
    sent,
    received,
    unseenCount,
    loading,
    error,
    sendRecommendation,
    deleteRecommendation,
    markAllSeen,
    refetch: fetchRecos,
  }
}
