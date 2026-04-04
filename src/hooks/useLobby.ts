import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { QuizData } from '../lib/quiz'

export interface LobbyFilm {
  tmdb_id: number
  title: string
  poster_path: string | null
  release_date: string | null
  genres: string[]
}

export interface Lobby {
  id: string
  couple_id: string
  created_by: string
  status: 'picking' | 'ready' | 'battle' | 'quiz' | 'done'
  mode: 'random' | 'battle' | 'quiz' | null
  film_user1: LobbyFilm | null
  film_user2: LobbyFilm | null
  score_user1: number
  score_user2: number
  winner_film: LobbyFilm | null
  quiz_data: QuizData | null
  created_at: string
}

export function useLobby(coupleId: string | null, userId: string | null, isUser1: boolean) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Fetch active lobby for this couple
  const fetchLobby = useCallback(async () => {
    if (!coupleId) {
      setLobby(null)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('movie_night_lobbies')
      .select('*')
      .eq('couple_id', coupleId)
      .in('status', ['picking', 'ready', 'battle', 'quiz', 'done'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setLobby(data as Lobby | null)
    setLoading(false)
  }, [coupleId])

  // Subscribe to realtime changes
  useEffect(() => {
    if (!coupleId) return

    fetchLobby()

    const channel = supabase
      .channel(`lobby:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'movie_night_lobbies',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setLobby(null)
          } else {
            setLobby(payload.new as Lobby)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [coupleId, fetchLobby])

  // Create a new lobby
  const create = useCallback(async () => {
    if (!coupleId || !userId) return

    // Clean up old active lobbies first
    await supabase
      .from('movie_night_lobbies')
      .delete()
      .eq('couple_id', coupleId)
      .in('status', ['picking', 'ready', 'battle', 'quiz'])

    const { data, error } = await supabase
      .from('movie_night_lobbies')
      .insert({
        couple_id: coupleId,
        created_by: userId,
        status: 'picking',
      })
      .select()
      .single()

    if (!error && data) {
      setLobby(data as Lobby)
    }
    return { error: error?.message ?? null }
  }, [coupleId, userId])

  // Submit my film pick
  const submitFilm = useCallback(async (film: LobbyFilm) => {
    if (!lobby) return

    const field = isUser1 ? 'film_user1' : 'film_user2'
    const updates: Record<string, unknown> = { [field]: film }

    // Check if partner already submitted → auto-advance to ready
    const otherFilm = isUser1 ? lobby.film_user2 : lobby.film_user1
    if (otherFilm) {
      updates.status = 'ready'
    }

    await supabase
      .from('movie_night_lobbies')
      .update(updates)
      .eq('id', lobby.id)
  }, [lobby, isUser1])

  // Choose mode (random, battle, or quiz)
  const chooseMode = useCallback(async (mode: 'random' | 'battle' | 'quiz') => {
    if (!lobby) return

    const updates: Record<string, unknown> = { mode }
    if (mode === 'battle') {
      updates.status = 'battle'
      updates.score_user1 = 0
      updates.score_user2 = 0
    } else if (mode === 'quiz') {
      updates.status = 'quiz'
    }

    await supabase
      .from('movie_night_lobbies')
      .update(updates)
      .eq('id', lobby.id)
  }, [lobby])

  // Mark myself as ready for battle
  const setReady = useCallback(async () => {
    if (!lobby) return
    const field = isUser1 ? 'score_user1' : 'score_user2'
    await supabase
      .from('movie_night_lobbies')
      .update({ [field]: -1 })
      .eq('id', lobby.id)
  }, [lobby, isUser1])

  // Set winner (after random or battle)
  const setWinner = useCallback(async (winnerFilm: LobbyFilm, scoreU1?: number, scoreU2?: number) => {
    if (!lobby) return

    const updates: Record<string, unknown> = {
      status: 'done',
      winner_film: winnerFilm,
    }
    if (scoreU1 !== undefined) updates.score_user1 = scoreU1
    if (scoreU2 !== undefined) updates.score_user2 = scoreU2

    await supabase
      .from('movie_night_lobbies')
      .update(updates)
      .eq('id', lobby.id)
  }, [lobby])

  // Update battle score
  const updateScore = useCallback(async (score: number) => {
    if (!lobby) return
    const field = isUser1 ? 'score_user1' : 'score_user2'
    await supabase
      .from('movie_night_lobbies')
      .update({ [field]: score })
      .eq('id', lobby.id)
  }, [lobby, isUser1])

  // Update quiz data (merge partial into existing)
  const updateQuizData = useCallback(async (data: Partial<QuizData>) => {
    if (!lobby) return
    const current = lobby.quiz_data ?? {}
    await supabase
      .from('movie_night_lobbies')
      .update({ quiz_data: { ...current, ...data } })
      .eq('id', lobby.id)
  }, [lobby])

  // Submit quiz answer (each user writes only their own arrays)
  const submitQuizAnswer = useCallback(async (
    questionIndex: number,
    answerIndex: number,
    timeMs: number,
    score: number
  ) => {
    if (!lobby?.quiz_data) return
    const qd = { ...lobby.quiz_data }

    const answers = isUser1 ? [...qd.answers_user1] : [...qd.answers_user2]
    const times = isUser1 ? [...qd.times_user1] : [...qd.times_user2]
    answers[questionIndex] = answerIndex
    times[questionIndex] = timeMs

    const scores: [number, number] = [...qd.scores]
    if (isUser1) scores[0] += score
    else scores[1] += score

    const updates: Partial<QuizData> = { scores }
    if (isUser1) {
      updates.answers_user1 = answers
      updates.times_user1 = times
    } else {
      updates.answers_user2 = answers
      updates.times_user2 = times
    }

    await supabase
      .from('movie_night_lobbies')
      .update({ quiz_data: { ...qd, ...updates } })
      .eq('id', lobby.id)
  }, [lobby, isUser1])

  // Advance to next question (host only)
  const advanceQuiz = useCallback(async (nextIndex: number, phase: QuizData['phase']) => {
    if (!lobby?.quiz_data) return
    await supabase
      .from('movie_night_lobbies')
      .update({
        quiz_data: {
          ...lobby.quiz_data,
          current_index: nextIndex,
          question_started_at: new Date().toISOString(),
          phase,
        },
      })
      .eq('id', lobby.id)
  }, [lobby])

  // Cancel / delete lobby
  const cancel = useCallback(async () => {
    if (!lobby) return
    await supabase
      .from('movie_night_lobbies')
      .delete()
      .eq('id', lobby.id)
    setLobby(null)
  }, [lobby])

  // Dismiss finished lobby (delete and clear)
  const dismiss = useCallback(async () => {
    if (!lobby) return
    await supabase
      .from('movie_night_lobbies')
      .delete()
      .eq('id', lobby.id)
    setLobby(null)
  }, [lobby])

  return {
    lobby,
    loading,
    create,
    submitFilm,
    chooseMode,
    setWinner,
    updateScore,
    cancel,
    dismiss,
    setReady,
    updateQuizData,
    submitQuizAnswer,
    advanceQuiz,
    myFilm: isUser1 ? lobby?.film_user1 : lobby?.film_user2,
    partnerFilm: isUser1 ? lobby?.film_user2 : lobby?.film_user1,
  }
}
