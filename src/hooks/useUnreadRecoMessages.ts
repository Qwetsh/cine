import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Compteurs de messages non lus par recommandation, persistés en base
 * (colonne read_at) : les badges survivent au rechargement et aux messages
 * reçus app fermée. Complété par le realtime pendant la session.
 */
export function useUnreadRecoMessages(userId: string | null) {
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map())

  // Chargement initial depuis la base (la RLS limite aux fils de mes recos)
  const fetchUnread = useCallback(async () => {
    if (!userId) {
      setUnreadMap(new Map())
      return
    }

    const { data, error } = await supabase
      .from('recommendation_messages')
      .select('recommendation_id')
      .is('read_at', null)
      .neq('sender_id', userId)

    if (error || !data) return

    const map = new Map<string, number>()
    for (const row of data as { recommendation_id: string }[]) {
      map.set(row.recommendation_id, (map.get(row.recommendation_id) ?? 0) + 1)
    }
    setUnreadMap(map)
  }, [userId])

  useEffect(() => {
    fetchUnread()
  }, [fetchUnread])

  // Realtime : incrémenter à l'arrivée d'un message pendant la session
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('reco-messages-global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recommendation_messages',
        },
        (payload) => {
          const msg = payload.new as { sender_id: string; recommendation_id: string }
          if (msg.sender_id === userId) return
          setUnreadMap((prev) => {
            const next = new Map(prev)
            next.set(msg.recommendation_id, (next.get(msg.recommendation_id) ?? 0) + 1)
            return next
          })
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  const markRead = useCallback((recommendationId: string) => {
    // Optimistic : retirer le badge tout de suite
    setUnreadMap((prev) => {
      if (!prev.has(recommendationId)) return prev
      const next = new Map(prev)
      next.delete(recommendationId)
      return next
    })

    // Persister (le grant colonne ne permet de modifier que read_at)
    if (userId) {
      supabase
        .from('recommendation_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('recommendation_id', recommendationId)
        .neq('sender_id', userId)
        .is('read_at', null)
        .then(({ error }) => {
          if (error) console.error('markRead error:', error)
        })
    }
  }, [userId])

  const totalUnread = Array.from(unreadMap.values()).reduce((sum, n) => sum + n, 0)

  return { unreadMap, totalUnread, markRead }
}
