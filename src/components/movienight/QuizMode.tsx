import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useQuizLobby } from '../../hooks/useQuizLobby'
import { QuizSoloMode } from './QuizSoloMode'
import { QuizLobby, QuizJoinScreen } from './QuizLobby'
import { generateQuizQuestions, createEmptyQuizData } from '../../lib/quiz'
import type { QuizData } from '../../lib/quiz'
import { LobbyPicking } from './LobbyPicking'
import { QuizGame } from './QuizGame'

type Screen = 'home' | 'solo' | '1v1-menu' | '1v1-create' | '1v1-join' | '1v1-lobby'

export function QuizMode() {
  const { user } = useAuth()
  const lobby = useQuizLobby(user?.id ?? null)
  const [screen, setScreen] = useState<Screen>('home')
  const [joinCode, setJoinCode] = useState<string | null>(null)
  const [partnerLeft, setPartnerLeft] = useState(false)
  const prevSessionRef = useRef<typeof lobby.session>(null)

  // Detect partner leaving mid-game
  useEffect(() => {
    const prev = prevSessionRef.current
    if (prev && !lobby.session && prev.status === 'playing') {
      setPartnerLeft(true)
    }
    prevSessionRef.current = lobby.session
  }, [lobby.session])

  // Auto-navigate when session status changes
  useEffect(() => {
    if (lobby.session?.status === 'playing' || lobby.session?.status === 'done') {
      setScreen('1v1-lobby')
    }
  }, [lobby.session?.status])

  const opponentName = lobby.session?.player2_id ? 'Adversaire' : null

  // ── Solo ──
  if (screen === 'solo') {
    return <QuizSoloMode onBack={() => setScreen('home')} />
  }

  // Partner left
  if (partnerLeft && !lobby.session) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">👋</span>
        <p className="text-[var(--color-text)] font-medium">
          L'adversaire a quitté le quiz
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          La session a été interrompue
        </p>
        <button
          onClick={() => { setPartnerLeft(false); setScreen('home') }}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          OK
        </button>
      </div>
    )
  }

  // ── Home ──
  if (screen === 'home') {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-6xl block">🧠</span>
        <p className="text-[var(--color-text)] font-medium">Quiz Ciné</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Testez vos connaissances ciné !
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => setScreen('solo')}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
          >
            🧠 Quiz Solo
          </button>
          <p className="text-xs text-[var(--color-text-muted)]">
            Testez vos connaissances seul
          </p>

          <button
            onClick={() => setScreen('1v1-menu')}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3.5 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            ⚔️ Quiz 1v1
          </button>
          <p className="text-xs text-[var(--color-text-muted)]">
            Défiez un ami en temps réel
          </p>
        </div>
      </div>
    )
  }

  // ── 1v1 Menu ──
  if (screen === '1v1-menu') {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">⚔️</span>
        <p className="text-[var(--color-text)] font-medium">Quiz 1v1</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Jouez avec n'importe qui via un code
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={async () => {
              const code = await lobby.create('classic')
              if (code) {
                setJoinCode(code)
                setScreen('1v1-lobby')
              }
            }}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
          >
            🎯 Créer une partie
          </button>
          <button
            onClick={() => setScreen('1v1-join')}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3.5 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            🔑 Rejoindre une partie
          </button>
          <button
            onClick={() => setScreen('home')}
            className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    )
  }

  // ── 1v1 Join ──
  if (screen === '1v1-join') {
    return (
      <QuizJoinScreen
        onJoin={async (code) => {
          const ok = await lobby.joinByCode(code)
          if (ok) {
            setJoinCode(code)
            setScreen('1v1-lobby')
          }
          return ok
        }}
        onBack={() => setScreen('1v1-menu')}
        error={lobby.error}
      />
    )
  }

  // ── Active session (1v1 lobby / playing / done) ──
  if (lobby.session) {
    const { session } = lobby

    // Done → results
    if (session.status === 'done') {
      const myScore = lobby.isUser1 ? session.score_user1 : session.score_user2
      const theirScore = lobby.isUser1 ? session.score_user2 : session.score_user1
      const winner = myScore > theirScore ? 'Toi'
        : theirScore > myScore ? (opponentName ?? 'Adversaire')
        : 'Égalité'

      return (
        <div className="px-4 text-center py-8 space-y-5">
          <span className="text-6xl block">🏆</span>
          <p className="text-xl font-bold text-[var(--color-text)]">
            {winner === 'Égalité' ? 'Égalité !' : winner === 'Toi' ? 'Tu as gagné !' : `${winner} a gagné !`}
          </p>
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Toi</p>
              <p className="text-3xl font-bold text-[var(--color-accent)]">{myScore}</p>
            </div>
            <div className="text-[var(--color-text-muted)] self-center text-lg">vs</div>
            <div className="text-center">
              <p className="text-xs text-[var(--color-text-muted)]">{opponentName ?? 'Adversaire'}</p>
              <p className="text-3xl font-bold text-red-400">{theirScore}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await lobby.dismiss()
              setScreen('home')
              setJoinCode(null)
            }}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            Terminer
          </button>
        </div>
      )
    }

    // Setup → lobby config
    if (session.status === 'setup') {
      return (
        <QuizLobby
          lobby={lobby}
          joinCode={joinCode}
          opponentName={opponentName}
          onBack={() => { setScreen('home'); setJoinCode(null) }}
        />
      )
    }

    // Picking (fight mode)
    if (session.status === 'picking') {
      return (
        <LobbyPicking
          myFilm={lobby.myFilm ?? null}
          partnerFilm={lobby.partnerFilm ?? null}
          partnerName={opponentName ?? 'Adversaire'}
          onSubmit={lobby.submitFilm}
          onCancel={async () => {
            await lobby.cancel()
            setScreen('home')
            setJoinCode(null)
          }}
        />
      )
    }

    // Playing
    if (session.status === 'playing') {
      return (
        <QuizPlayPhase
          lobby={lobby}
          opponentName={opponentName ?? 'Adversaire'}
          onQuit={() => { setScreen('home'); setJoinCode(null) }}
        />
      )
    }
  }

  return null
}

// ── Play Phase: generate questions + QuizGame ──

function QuizPlayPhase({
  lobby,
  opponentName,
  onQuit,
}: {
  lobby: ReturnType<typeof useQuizLobby>
  opponentName: string
  onQuit: () => void
}) {
  const generatingRef = useRef(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const { session, isUser1 } = lobby
  const quizData = session?.quiz_data as QuizData | null

  // Host generates questions
  useEffect(() => {
    if (!isUser1 || generatingRef.current || !session) return
    if (quizData && quizData.questions.length > 0) return

    generatingRef.current = true

    async function generate() {
      try {
        const questions = await generateQuizQuestions({
          difficulty: session!.difficulty,
          yearMin: session!.year_min,
          yearMax: session!.year_max,
          enabledTypes: session!.question_types?.length ? session!.question_types : undefined,
          count: session!.question_count ?? 10,
          film1TmdbId: session!.film_user1?.tmdb_id,
          film2TmdbId: session!.film_user2?.tmdb_id,
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
        await lobby.updateQuizData(data)
      } catch (err) {
        console.error('Quiz generation error:', err)
      }
    }

    generate()
  }, [isUser1, session, quizData, lobby])

  const handleAdvance = useCallback((nextIndex: number, phase: QuizData['phase']) => {
    lobby.advanceQuiz(nextIndex, phase)
  }, [lobby])

  const handleGameEnd = useCallback((s1: number, s2: number) => {
    lobby.finish(s1, s2)
  }, [lobby])

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
            onClick={async () => { await lobby.cancel(); onQuit() }}
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
        partnerName={opponentName}
        isUser1={isUser1}
        isHost={isUser1}
        onAnswer={lobby.submitQuizAnswer}
        onAdvance={handleAdvance}
        onGameEnd={handleGameEnd}
      />
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
