import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Tracks unread message counts per recommendation in realtime.
 * A message is "unread" if it was sent by someone else and the thread
 * hasn't been opened since.
 */
export function useUnreadRecoMessages(userId: string | null) {
  const [unreadMap, setUnreadMap] = useState<Map<string, number>>(new Map())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Subscribe to all new messages not from me
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

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [userId])

  const markRead = useCallback((recommendationId: string) => {
    setUnreadMap((prev) => {
      if (!prev.has(recommendationId)) return prev
      const next = new Map(prev)
      next.delete(recommendationId)
      return next
    })
  }, [])

  const totalUnread = Array.from(unreadMap.values()).reduce((sum, n) => sum + n, 0)

  return { unreadMap, totalUnread, markRead }
}
