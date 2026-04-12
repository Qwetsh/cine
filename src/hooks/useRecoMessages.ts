import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { RecommendationMessage } from '../types'

export interface UseRecoMessagesState {
  messages: RecommendationMessage[]
  loading: boolean
  sending: boolean
  sendMessage: (content: string) => Promise<void>
}

export function useRecoMessages(
  recommendationId: string | null,
  userId: string | null,
): UseRecoMessagesState {
  const [messages, setMessages] = useState<RecommendationMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Fetch existing messages
  const fetchMessages = useCallback(async () => {
    if (!recommendationId) return
    setLoading(true)

    const { data, error } = await supabase
      .from('recommendation_messages')
      .select('*')
      .eq('recommendation_id', recommendationId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setMessages(data as unknown as RecommendationMessage[])
    }
    setLoading(false)
  }, [recommendationId])

  // Subscribe to realtime
  useEffect(() => {
    if (!recommendationId) return

    fetchMessages()

    const channel = supabase
      .channel(`reco-messages:${recommendationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recommendation_messages',
          filter: `recommendation_id=eq.${recommendationId}`,
        },
        (payload) => {
          const newMsg = payload.new as unknown as RecommendationMessage
          setMessages((prev) => {
            // Avoid duplicates (optimistic + realtime)
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
        },
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [recommendationId, fetchMessages])

  // Reset when recommendation changes
  useEffect(() => {
    if (!recommendationId) {
      setMessages([])
    }
  }, [recommendationId])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!recommendationId || !userId || !content.trim()) return
      setSending(true)

      const optimistic: RecommendationMessage = {
        id: crypto.randomUUID(),
        recommendation_id: recommendationId,
        sender_id: userId,
        content: content.trim(),
        created_at: new Date().toISOString(),
      }

      // Optimistic add
      setMessages((prev) => [...prev, optimistic])

      const { error } = await supabase
        .from('recommendation_messages')
        .insert({
          recommendation_id: recommendationId,
          sender_id: userId,
          content: content.trim(),
        })

      if (error) {
        // Rollback optimistic
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      }

      setSending(false)
    },
    [recommendationId, userId],
  )

  return { messages, loading, sending, sendMessage }
}
