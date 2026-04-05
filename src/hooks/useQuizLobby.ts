import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { QuizData } from '../lib/quiz'
import type { LobbyFilm } from './useLobby'
import type { QuizDifficulty } from '../lib/discover'

export type QuizType = 'classic' | 'fight'
export type QuizTheme = 'actor' | 'director' | 'country' | 'decade' | 'general' | 'poster'

export interface QuizSession {
  id: string
  couple_id: string
  created_by: string
  type: QuizType
  status: 'setup' | 'picking' | 'playing' | 'done'
  theme: QuizTheme | null
  theme_value: string | null
  difficulty: QuizDifficulty | null
  film_user1: LobbyFilm | null
  film_user2: LobbyFilm | null
  quiz_data: QuizData | null
  score_user1: number
  score_user2: number
  created_at: string
}

export function useQuizLobby(coupleId: string | null, userId: string | null, isUser1: boolean) {
  const [session, setSession] = useState<QuizSession | null>(null)
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const fetchSession = useCallback(async () => {
    if (!coupleId) {
      setSession(null)
      setLoading(false)
      return
    }

    const { data } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('couple_id', coupleId)
      .in('status', ['setup', 'picking', 'playing', 'done'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setSession(data as QuizSession | null)
    setLoading(false)
  }, [coupleId])

  // Realtime subscription
  useEffect(() => {
    if (!coupleId) return

    fetchSession()

    const channel = supabase
      .channel(`quiz:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_sessions',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSession(null)
          } else {
            setSession(payload.new as QuizSession)
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

  // Create a new quiz session
  const create = useCallback(async (type: QuizType) => {
    if (!coupleId || !userId) return

    // Clean old sessions
    await supabase
      .from('quiz_sessions')
      .delete()
      .eq('couple_id', coupleId)
      .in('status', ['setup', 'picking', 'playing'])

    const { data, error } = await supabase
      .from('quiz_sessions')
      .insert({
        couple_id: coupleId,
        created_by: userId,
        type,
        status: type === 'fight' ? 'picking' : 'setup',
      })
      .select()
      .single()

    if (!error && data) {
      setSession(data as QuizSession)
    }
  }, [coupleId, userId])

  // Set theme (classic mode)
  const setTheme = useCallback(async (theme: QuizTheme, themeValue?: string, difficulty?: QuizDifficulty) => {
    if (!session) return
    await supabase
      .from('quiz_sessions')
      .update({ theme, theme_value: themeValue ?? null, difficulty: difficulty ?? 'normal' })
      .eq('id', session.id)
  }, [session])

  // Start playing (after setup or picking)
  const startPlaying = useCallback(async () => {
    if (!session) return
    await supabase
      .from('quiz_sessions')
      .update({ status: 'playing' })
      .eq('id', session.id)
  }, [session])

  // Submit film pick (fight mode)
  const submitFilm = useCallback(async (film: LobbyFilm) => {
    if (!session) return
    const field = isUser1 ? 'film_user1' : 'film_user2'
    const updates: Record<string, unknown> = { [field]: film }

    // Check if partner already submitted
    const otherFilm = isUser1 ? session.film_user2 : session.film_user1
    if (otherFilm) {
      updates.status = 'playing'
    }

    await supabase
      .from('quiz_sessions')
      .update(updates)
      .eq('id', session.id)
  }, [session, isUser1])

  // Update quiz data
  const updateQuizData = useCallback(async (data: Partial<QuizData>) => {
    if (!session) return
    const current = session.quiz_data ?? {}
    await supabase
      .from('quiz_sessions')
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
      .from('quiz_sessions')
      .update({ quiz_data: { ...qd, ...updates } })
      .eq('id', session.id)
  }, [session, isUser1])

  // Advance question (host only)
  const advanceQuiz = useCallback(async (nextIndex: number, phase: QuizData['phase']) => {
    if (!session?.quiz_data) return
    await supabase
      .from('quiz_sessions')
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
      .from('quiz_sessions')
      .update({ status: 'done', score_user1: score1, score_user2: score2 })
      .eq('id', session.id)
  }, [session])

  // Cancel / delete
  const cancel = useCallback(async () => {
    if (!session) return
    await supabase
      .from('quiz_sessions')
      .delete()
      .eq('id', session.id)
    setSession(null)
  }, [session])

  // Dismiss finished session
  const dismiss = useCallback(async () => {
    if (!session) return
    await supabase
      .from('quiz_sessions')
      .delete()
      .eq('id', session.id)
    setSession(null)
  }, [session])

  return {
    session,
    loading,
    create,
    setTheme,
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
