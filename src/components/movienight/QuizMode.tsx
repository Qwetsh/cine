import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCoupleContext } from '../../contexts/CoupleContext'
import { useQuizLobby } from '../../hooks/useQuizLobby'
import type { QuizTheme } from './QuizClassicSetup'
import { ClassicSetup, THEME_LABELS, DIFFICULTY_LABELS } from './QuizClassicSetup'
import { QuizSoloMode } from './QuizSoloMode'
import { generateQuizQuestions, createEmptyQuizData } from '../../lib/quiz'
import type { QuizData } from '../../lib/quiz'
import type { QuizDifficulty } from '../../lib/discover'
import { LobbyPicking } from './LobbyPicking'
import { QuizGame } from './QuizGame'

export function QuizMode() {
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const quiz = useQuizLobby(coupleId, user?.id ?? null, isUser1)

  const partnerName = partner?.display_name ?? 'Partenaire'

  // Solo mode is fully local — no Supabase needed
  const [soloMode, setSoloMode] = useState(false)

  // Track if partner left mid-quiz
  const [partnerLeft, setPartnerLeft] = useState(false)
  const prevSessionRef = useRef<typeof quiz.session>(null)

  useEffect(() => {
    const prev = prevSessionRef.current
    if (prev && !quiz.session && (prev.status === 'playing' || (prev.status === 'setup' && prev.theme))) {
      setPartnerLeft(true)
    }
    prevSessionRef.current = quiz.session
  }, [quiz.session])

  // Solo mode — fully self-contained
  if (soloMode) {
    return <QuizSoloMode onBack={() => setSoloMode(false)} />
  }

  if (quiz.loading && coupleId) {
    return (
      <div className="px-4 py-8">
        <div className="h-40 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
      </div>
    )
  }

  // Partner left message
  if (partnerLeft && !quiz.session) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">👋</span>
        <p className="text-[var(--color-text)] font-medium">
          {partnerName} a quitté le quiz
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          La session a été interrompue
        </p>
        <button
          onClick={() => setPartnerLeft(false)}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          OK
        </button>
      </div>
    )
  }

  // No active session → choose quiz type
  if (!quiz.session) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-6xl block">🧠</span>
        <p className="text-[var(--color-text)] font-medium">Quiz Ciné</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Testez vos connaissances ciné !
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => setSoloMode(true)}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
          >
            🧠 Quiz Solo
          </button>
          <p className="text-xs text-[var(--color-text-muted)]">
            Testez vos connaissances seul
          </p>

          {coupleId ? (
            <>
              <button
                onClick={() => quiz.create('classic')}
                className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3.5 font-medium text-sm border border-[var(--color-border)] transition-colors"
              >
                🎯 Quiz Classique
              </button>
              <p className="text-xs text-[var(--color-text-muted)]">
                Choisissez un thème et répondez en duo
              </p>
              <button
                onClick={() => quiz.create('fight')}
                className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3.5 font-medium text-sm border border-[var(--color-border)] transition-colors"
              >
                ⚔️ Quiz Fight
              </button>
              <p className="text-xs text-[var(--color-text-muted)]">
                Chacun choisit le film des questions de l'autre
              </p>
            </>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)] pt-2">
              💑 Liez vos comptes pour débloquer les modes duo
            </p>
          )}
        </div>
      </div>
    )
  }

  const { session } = quiz
  const isCreator = session.created_by === user?.id

  // Done → results
  if (session.status === 'done') {
    const myScore = isUser1 ? session.score_user1 : session.score_user2
    const theirScore = isUser1 ? session.score_user2 : session.score_user1
    const winner = myScore > theirScore ? 'Toi'
      : theirScore > myScore ? partnerName
      : 'Égalité'

    return (
      <div className="px-4 text-center py-8 space-y-5">
        <span className="text-6xl block">🏆</span>
        <p className="text-xl font-bold text-[var(--color-text)]">
          {winner === 'Égalité' ? 'Égalité !' : `${winner} gagne !`}
        </p>
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Toi</p>
            <p className="text-3xl font-bold text-[var(--color-accent)]">{myScore}</p>
          </div>
          <div className="text-[var(--color-text-muted)] self-center text-lg">vs</div>
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">{partnerName}</p>
            <p className="text-3xl font-bold text-red-400">{theirScore}</p>
          </div>
        </div>
        {session.theme && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {THEME_LABELS[session.theme]}
            {session.theme_value ? ` — ${session.theme_value}` : ''}
          </p>
        )}
        <button
          onClick={quiz.dismiss}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          Terminer
        </button>
      </div>
    )
  }

  // Classic: setup phase
  if (session.type === 'classic' && session.status === 'setup') {
    // Theme not yet chosen → creator picks theme
    if (!session.theme) {
      if (isCreator) {
        return (
          <ClassicSetup
            onSelectTheme={quiz.setTheme}
            onCancel={quiz.cancel}
            confirmLabel="Proposer ce thème"
          />
        )
      }
      // Partner waiting for creator to pick theme
      return (
        <div className="px-4 text-center py-12 space-y-4">
          <span className="text-5xl block animate-pulse">🎯</span>
          <p className="text-[var(--color-text)] font-medium">Quiz Classique</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {partnerName} choisit le thème du quiz…
          </p>
          <button
            onClick={quiz.cancel}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Quitter
          </button>
        </div>
      )
    }

    // Theme chosen → waiting for partner to join
    if (isCreator) {
      return (
        <div className="px-4 text-center py-12 space-y-4">
          <span className="text-5xl block">🎯</span>
          <p className="text-[var(--color-text)] font-medium">Quiz Classique</p>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm text-[var(--color-text-muted)]">Thème choisi :</p>
            <p className="text-lg font-bold text-[var(--color-text)] mt-1">
              {THEME_LABELS[session.theme]}
              {session.theme_value ? ` — ${session.theme_value}` : ''}
            </p>
            {session.difficulty && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {DIFFICULTY_LABELS[session.difficulty]}
              </p>
            )}
          </div>
          <div className="animate-pulse">
            <span className="text-3xl">⏳</span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            En attente de {partnerName}…
          </p>
          <button
            onClick={quiz.cancel}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Annuler
          </button>
        </div>
      )
    }

    // Partner sees the invite → can join
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">🎯</span>
        <p className="text-[var(--color-text)] font-medium">
          {partnerName} te lance un Quiz !
        </p>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Thème :</p>
          <p className="text-lg font-bold text-[var(--color-text)] mt-1">
            {THEME_LABELS[session.theme]}
            {session.theme_value ? ` — ${session.theme_value}` : ''}
          </p>
          {session.difficulty && (
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {DIFFICULTY_LABELS[session.difficulty]}
            </p>
          )}
        </div>
        <button
          onClick={quiz.startPlaying}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
        >
          Rejoindre le quiz !
        </button>
        <button
          onClick={quiz.cancel}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
        >
          Refuser
        </button>
      </div>
    )
  }

  // Fight: picking films
  if (session.type === 'fight' && session.status === 'picking') {
    return (
      <LobbyPicking
        myFilm={quiz.myFilm ?? null}
        partnerFilm={quiz.partnerFilm ?? null}
        partnerName={partnerName}
        onSubmit={quiz.submitFilm}
        onCancel={quiz.cancel}
      />
    )
  }

  // Playing → generate questions if needed, then QuizGame
  if (session.status === 'playing') {
    return (
      <QuizPlayPhase
        quiz={quiz}
        partnerName={partnerName}
        isUser1={isUser1}
      />
    )
  }

  return null
}

// ── Play Phase: generate questions + QuizGame + quit button ──

function QuizPlayPhase({
  quiz,
  partnerName,
  isUser1,
}: {
  quiz: ReturnType<typeof useQuizLobby>
  partnerName: string
  isUser1: boolean
}) {
  const generatingRef = useRef(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const { session } = quiz
  const quizData = session?.quiz_data as QuizData | null

  // Host generates questions (shared logic via generateQuizQuestions)
  useEffect(() => {
    if (!isUser1 || generatingRef.current || !session) return
    if (quizData && quizData.questions.length > 0) return

    generatingRef.current = true

    async function generate() {
      try {
        const questions = await generateQuizQuestions({
          type: session!.type as 'classic' | 'fight',
          theme: session!.theme,
          themeValue: session!.theme_value,
          difficulty: (session!.difficulty as QuizDifficulty) ?? 'normal',
          film1TmdbId: session!.film_user1?.tmdb_id,
          film2TmdbId: session!.film_user2?.tmdb_id,
          count: 10,
        })

        if (questions.length === 0) {
          console.error('No questions generated')
          return
        }

        const data = createEmptyQuizData()
        data.questions = questions
        data.answers_user1 = new Array(questions.length).fill(null)
        data.answers_user2 = new Array(questions.length).fill(null)
        data.times_user1 = new Array(questions.length).fill(null)
        data.times_user2 = new Array(questions.length).fill(null)
        data.phase = 'countdown'
        await quiz.updateQuizData(data)
      } catch (err) {
        console.error('Quiz generation error:', err)
      }
    }

    generate()
  }, [isUser1, session, quizData, quiz])

  const handleAdvance = useCallback((nextIndex: number, phase: QuizData['phase']) => {
    quiz.advanceQuiz(nextIndex, phase)
  }, [quiz])

  const handleGameEnd = useCallback((s1: number, s2: number) => {
    quiz.finish(s1, s2)
  }, [quiz])

  // Quit confirmation overlay
  if (confirmQuit) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">⚠️</span>
        <p className="text-[var(--color-text)] font-medium">Quitter le quiz ?</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          La session sera terminée pour les deux joueurs.
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => quiz.cancel()}
            className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            Oui, quitter
          </button>
          <button
            onClick={() => setConfirmQuit(false)}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            Reprendre le quiz
          </button>
        </div>
      </div>
    )
  }

  if (!quizData || quizData.questions.length === 0) {
    return (
      <div className="px-4 text-center py-16">
        <span className="text-5xl block mb-4 animate-pulse">🧠</span>
        <p className="text-sm text-[var(--color-text-muted)]">Génération des questions...</p>
        <button
          onClick={() => setConfirmQuit(true)}
          className="mt-6 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Quitter
        </button>
      </div>
    )
  }

  return (
    <div>
      <QuizGame
        quizData={quizData}
        partnerName={partnerName}
        isUser1={isUser1}
        isHost={isUser1}
        onAnswer={quiz.submitQuizAnswer}
        onAdvance={handleAdvance}
        onGameEnd={handleGameEnd}
      />
      {/* Quit button below the quiz */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => setConfirmQuit(true)}
          className="w-full text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
        >
          Quitter le quiz
        </button>
      </div>
    </div>
  )
}

