import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TournamentBoard, TournamentGameState } from '../lib/tournament-board'
import type { QuizDifficulty } from '../lib/discover'

export interface TournamentSession {
  id: string
  couple_id: string
  created_by: string
  status: 'waiting' | 'generating' | 'playing' | 'center_fight' | 'done'
  difficulty: QuizDifficulty | null
  board: TournamentBoard
  game_state: TournamentGameState
  winner_user_id: string | null
  created_at: string
}

export function useTournament(coupleId: string | null, userId: string | null) {
  const [session, setSession] = useState<TournamentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  // Cache the board locally — realtime payloads may truncate large JSONB columns
  const boardCacheRef = useRef<TournamentBoard | null>(null)

  const fetchSession = useCallback(async () => {
    if (!coupleId) {
      setSession(null)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('tournament_sessions')
      .select('*')
      .eq('couple_id', coupleId)
      .in('status', ['waiting', 'generating', 'playing', 'center_fight', 'done'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) {
      const s = data as TournamentSession
      // Cache the board if present
      if (s.board && s.board.nodes) {
        boardCacheRef.current = s.board
      }
      setSession(s)
    } else {
      boardCacheRef.current = null
      setSession(null)
    }
    setLoading(false)
  }, [coupleId])

  // Realtime subscription
  useEffect(() => {
    if (!coupleId) return

    fetchSession()

    const channel = supabase
      .channel(`tournament:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_sessions',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            boardCacheRef.current = null
            setSession(null)
          } else {
            const incoming = payload.new as TournamentSession
            // Realtime may not include the full board (payload size limit).
            // Use cached board if the incoming one is missing/empty.
            if (incoming.board && incoming.board.nodes) {
              boardCacheRef.current = incoming.board
            } else if (boardCacheRef.current) {
              incoming.board = boardCacheRef.current
            }
            setSession(incoming)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [coupleId, fetchSession])

  // Create a new tournament session
  const create = useCallback(async (difficulty: QuizDifficulty = 'normal') => {
    if (!coupleId || !userId) return

    // Clean old sessions
    await supabase
      .from('tournament_sessions')
      .delete()
      .eq('couple_id', coupleId)
      .in('status', ['waiting', 'generating', 'playing', 'center_fight'])

    boardCacheRef.current = null

    const { data, error } = await supabase
      .from('tournament_sessions')
      .insert({
        couple_id: coupleId,
        created_by: userId,
        status: 'waiting',
        difficulty,
      })
      .select()
      .single()

    if (!error && data) {
      setSession(data as TournamentSession)
    }
  }, [coupleId, userId])

  // Update session status
  const updateStatus = useCallback(async (status: TournamentSession['status']) => {
    if (!session) return
    await supabase
      .from('tournament_sessions')
      .update({ status })
      .eq('id', session.id)
  }, [session])

  // Set the board and initial game state (host only, after generation)
  const setBoard = useCallback(async (
    board: TournamentBoard,
    gameState: TournamentGameState,
  ) => {
    if (!session) return
    // Cache immediately
    boardCacheRef.current = board
    await supabase
      .from('tournament_sessions')
      .update({
        board,
        game_state: gameState,
        status: 'playing',
      })
      .eq('id', session.id)
  }, [session])

  // Update game state (any mutation during gameplay)
  const updateGameState = useCallback(async (gameState: TournamentGameState) => {
    if (!session) return
    await supabase
      .from('tournament_sessions')
      .update({ game_state: gameState })
      .eq('id', session.id)
  }, [session])

  // Update game state + status together (e.g., entering center_fight or done)
  const updateGameStateAndStatus = useCallback(async (
    gameState: TournamentGameState,
    status: TournamentSession['status'],
    winnerUserId?: string,
  ) => {
    if (!session) return
    const updates: Record<string, unknown> = { game_state: gameState, status }
    if (winnerUserId) updates.winner_user_id = winnerUserId
    await supabase
      .from('tournament_sessions')
      .update(updates)
      .eq('id', session.id)
  }, [session])

  // Cancel / delete
  const cancel = useCallback(async () => {
    if (!session) return
    await supabase
      .from('tournament_sessions')
      .delete()
      .eq('id', session.id)
    boardCacheRef.current = null
    setSession(null)
  }, [session])

  // Dismiss finished session
  const dismiss = useCallback(async () => {
    if (!session) return
    await supabase
      .from('tournament_sessions')
      .delete()
      .eq('id', session.id)
    boardCacheRef.current = null
    setSession(null)
  }, [session])

  return {
    session,
    loading,
    create,
    updateStatus,
    setBoard,
    updateGameState,
    updateGameStateAndStatus,
    cancel,
    dismiss,
  }
}
