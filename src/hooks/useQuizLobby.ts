import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { QuizData, QuestionType } from '../lib/quiz'
import type { LobbyFilm } from './useLobby'
import type { QuizDifficulty } from '../lib/discover'

export type QuizType = 'classic' | 'fight'

export interface QuizLobbyConfig {
  difficulty: QuizDifficulty
  yearMin: number
  yearMax: number
  questionTypes: QuestionType[]
  questionCount: number
}

export interface QuizLobbySession {
  id: string
  join_code: string
  created_by: string
  player2_id: string | null
  type: QuizType
  status: 'setup' | 'picking' | 'playing' | 'done'
  difficulty: QuizDifficulty
  year_min: number
  year_max: number
  question_types: QuestionType[]
  question_count: number
  film_user1: LobbyFilm | null
  film_user2: LobbyFilm | null
  quiz_data: QuizData | null
  score_user1: number
  score_user2: number
  expires_at: string
  created_at: string
}

function generateJoinCode(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()
}

export function useQuizLobby(userId: string | null) {
  const [session, setSession] = useState<QuizLobbySession | null>(null)
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const isUser1 = session ? session.created_by === userId : true

  // Subscribe to realtime updates for a specific lobby
  const subscribeTo = useCallback((lobbyId: string) => {
    // Clean previous subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`quiz-lobby:${lobbyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_lobbies',
          filter: `id=eq.${lobbyId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSession(null)
          } else {
            setSession(payload.new as QuizLobbySession)
          }
        }
      )
      .subscribe()

    channelRef.current = channel
  }, [])

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  // Create a new lobby
  const create = useCallback(async (type: QuizType): Promise<string | null> => {
    if (!userId) return null
    setError(null)

    const joinCode = generateJoinCode()
    const { data, error: err } = await supabase
      .from('quiz_lobbies')
      .insert({
        join_code: joinCode,
        created_by: userId,
        type,
        status: type === 'fight' ? 'picking' : 'setup',
      })
      .select()
      .single()

    if (err) {
      // Retry once on join_code collision
      const retryCode = generateJoinCode()
      const { data: d2, error: e2 } = await supabase
        .from('quiz_lobbies')
        .insert({
          join_code: retryCode,
          created_by: userId,
          type,
          status: type === 'fight' ? 'picking' : 'setup',
        })
        .select()
        .single()

      if (e2 || !d2) {
        setError('Impossible de créer la partie')
        return null
      }
      setSession(d2 as QuizLobbySession)
      subscribeTo(d2.id)
      return retryCode
    }

    if (data) {
      setSession(data as QuizLobbySession)
      subscribeTo(data.id)
      return joinCode
    }
    return null
  }, [userId, subscribeTo])

  // Join an existing lobby by code
  const joinByCode = useCallback(async (code: string): Promise<boolean> => {
    if (!userId) return false
    setError(null)

    const normalizedCode = code.trim().toUpperCase()

    // Find the lobby
    const { data: lobby, error: findErr } = await supabase
      .from('quiz_lobbies')
      .select('*')
      .eq('join_code', normalizedCode)
      .is('player2_id', null)
      .single()

    if (findErr || !lobby) {
      setError('Code invalide ou partie introuvable')
      return false
    }

    if (lobby.created_by === userId) {
      setError('Tu ne peux pas rejoindre ta propre partie')
      return false
    }

    // Check expiry
    if (new Date(lobby.expires_at) < new Date()) {
      setError('Cette partie a expiré')
      return false
    }

    // Join
    const { error: joinErr } = await supabase
      .from('quiz_lobbies')
      .update({ player2_id: userId })
      .eq('id', lobby.id)
      .is('player2_id', null) // Prevent race condition

    if (joinErr) {
      setError('Impossible de rejoindre')
      return false
    }

    setSession({ ...lobby, player2_id: userId } as QuizLobbySession)
    subscribeTo(lobby.id)
    return true
  }, [userId, subscribeTo])

  // Update quiz config (creator only, setup phase)
  const updateConfig = useCallback(async (config: Partial<QuizLobbyConfig>) => {
    if (!session || session.created_by !== userId) return

    const updates: Record<string, unknown> = {}
    if (config.difficulty !== undefined) updates.difficulty = config.difficulty
    if (config.yearMin !== undefined) updates.year_min = config.yearMin
    if (config.yearMax !== undefined) updates.year_max = config.yearMax
    if (config.questionTypes !== undefined) updates.question_types = config.questionTypes
    if (config.questionCount !== undefined) updates.question_count = config.questionCount

    await supabase
      .from('quiz_lobbies')
      .update(updates)
      .eq('id', session.id)
  }, [session, userId])

  // Start playing
  const startPlaying = useCallback(async () => {
    if (!session) return
    await supabase
      .from('quiz_lobbies')
      .update({ status: 'playing' })
      .eq('id', session.id)
  }, [session])

  // Submit film pick (fight mode)
  const submitFilm = useCallback(async (film: LobbyFilm) => {
    if (!session) return
    const field = isUser1 ? 'film_user1' : 'film_user2'
    const updates: Record<string, unknown> = { [field]: film }

    const otherFilm = isUser1 ? session.film_user2 : session.film_user1
    if (otherFilm) {
      updates.status = 'playing'
    }

    await supabase
      .from('quiz_lobbies')
      .update(updates)
      .eq('id', session.id)
  }, [session, isUser1])

  // Update quiz data
  const updateQuizData = useCallback(async (data: Partial<QuizData>) => {
    if (!session) return
    const current = session.quiz_data ?? {}
    await supabase
      .from('quiz_lobbies')
      .update({ quiz_data: { ...current, ...data } })
      .eq('id', session.id)
  }, [session])

  // Submit quiz answer
  const submitQuizAnswer = useCallback(async (
    questionIndex: number,
    answerIndex: number,
    timeMs: number,
    score: number
  ) => {
    if (!session?.quiz_data) return
    const qd = { ...session.quiz_data }

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
      .from('quiz_lobbies')
      .update({ quiz_data: { ...qd, ...updates } })
      .eq('id', session.id)
  }, [session, isUser1])

  // Advance question (host only)
  const advanceQuiz = useCallback(async (nextIndex: number, phase: QuizData['phase']) => {
    if (!session?.quiz_data) return
    await supabase
      .from('quiz_lobbies')
      .update({
        quiz_data: {
          ...session.quiz_data,
          current_index: nextIndex,
          question_started_at: new Date().toISOString(),
          phase,
        },
      })
      .eq('id', session.id)
  }, [session])

  // Finish quiz
  const finish = useCallback(async (score1: number, score2: number) => {
    if (!session) return
    await supabase
      .from('quiz_lobbies')
      .update({ status: 'done', score_user1: score1, score_user2: score2 })
      .eq('id', session.id)
  }, [session])

  // Cancel / delete
  const cancel = useCallback(async () => {
    if (!session) return
    await supabase
      .from('quiz_lobbies')
      .delete()
      .eq('id', session.id)
    setSession(null)
  }, [session])

  // Dismiss finished session
  const dismiss = useCallback(async () => {
    if (!session) return
    await supabase
      .from('quiz_lobbies')
      .delete()
      .eq('id', session.id)
    setSession(null)
  }, [session])

  return {
    session,
    loading,
    error,
    isUser1,
    create,
    joinByCode,
    updateConfig,
    startPlaying,
    submitFilm,
    updateQuizData,
    submitQuizAnswer,
    advanceQuiz,
    finish,
    cancel,
    dismiss,
    myFilm: isUser1 ? session?.film_user1 : session?.film_user2,
    partnerFilm: isUser1 ? session?.film_user2 : session?.film_user1,
  }
}
