import { useCallback, useRef, useState } from 'react'
import { ClassicSetup, THEME_LABELS, DIFFICULTY_LABELS } from './QuizClassicSetup'
import type { QuizTheme } from './QuizClassicSetup'
import { QuizGame } from './QuizGame'
import { generateQuizQuestions, createEmptyQuizData, calculateScore } from '../../lib/quiz'
import type { QuizData } from '../../lib/quiz'
import type { QuizDifficulty } from '../../lib/discover'

type SoloPhase = 'setup' | 'generating' | 'playing' | 'done'

interface Props {
  onBack: () => void
}

export function QuizSoloMode({ onBack }: Props) {
  const [phase, setPhase] = useState<SoloPhase>('setup')
  const [quizData, setQuizData] = useState<QuizData | null>(null)
  const [finalScore, setFinalScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [theme, setTheme] = useState<QuizTheme | null>(null)
  const [themeValue, setThemeValue] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<QuizDifficulty | null>(null)
  const [error, setError] = useState(false)
  const generatingRef = useRef(false)

  const handleSelectTheme = useCallback(async (
    selectedTheme: QuizTheme,
    value?: string,
    diff?: QuizDifficulty,
  ) => {
    if (generatingRef.current) return
    generatingRef.current = true
    setTheme(selectedTheme)
    setThemeValue(value ?? null)
    setDifficulty(diff ?? 'normal')
    setPhase('generating')
    setError(false)

    try {
      const questions = await generateQuizQuestions({
        type: 'classic',
        theme: selectedTheme,
        themeValue: value ?? null,
        difficulty: diff ?? 'normal',
        count: 10,
      })

      if (questions.length === 0) {
        setError(true)
        setPhase('setup')
        generatingRef.current = false
        return
      }

      const data = createEmptyQuizData()
      data.questions = questions
      data.answers_user1 = new Array(questions.length).fill(null)
      data.answers_user2 = new Array(questions.length).fill(null)
      data.times_user1 = new Array(questions.length).fill(null)
      data.times_user2 = new Array(questions.length).fill(null)
      data.phase = 'countdown'
      data.question_started_at = new Date().toISOString()
      setQuizData(data)
      setPhase('playing')
    } catch (err) {
      console.error('Solo quiz generation error:', err)
      setError(true)
      setPhase('setup')
    }
    generatingRef.current = false
  }, [])

  const handleAnswer = useCallback((
    questionIndex: number,
    answerIndex: number,
    timeMs: number,
    _score: number,
  ) => {
    setQuizData(prev => {
      if (!prev) return prev
      const next = { ...prev }
      const answers = [...next.answers_user1]
      const times = [...next.times_user1]
      answers[questionIndex] = answerIndex
      times[questionIndex] = timeMs
      const correct = answerIndex === next.questions[questionIndex]?.correct_index
      const pts = calculateScore(correct, timeMs)
      const scores: [number, number] = [next.scores[0] + pts, next.scores[1]]
      return { ...next, answers_user1: answers, times_user1: times, scores }
    })
  }, [])

  const handleAdvance = useCallback((nextIndex: number, nextPhase: QuizData['phase']) => {
    setQuizData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        current_index: nextIndex,
        question_started_at: new Date().toISOString(),
        phase: nextPhase,
      }
    })
  }, [])

  const handleGameEnd = useCallback((score1: number) => {
    setFinalScore(score1)
    if (quizData) {
      const correct = quizData.answers_user1.filter(
        (a, i) => a === quizData.questions[i]?.correct_index
      ).length
      setCorrectCount(correct)
    }
    setPhase('done')
  }, [quizData])

  // Setup phase
  if (phase === 'setup') {
    return (
      <div>
        {error && (
          <div className="mx-4 mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
            <p className="text-sm text-red-400">Pas assez de films trouvés pour ce thème. Essayez un autre.</p>
          </div>
        )}
        <ClassicSetup
          onSelectTheme={handleSelectTheme}
          onCancel={onBack}
          confirmLabel="Lancer le quiz"
        />
      </div>
    )
  }

  // Generating phase
  if (phase === 'generating') {
    return (
      <div className="px-4 text-center py-16">
        <span className="text-5xl block mb-4 animate-pulse">🧠</span>
        <p className="text-sm text-[var(--color-text-muted)]">Génération des questions...</p>
        <button
          onClick={onBack}
          className="mt-6 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Annuler
        </button>
      </div>
    )
  }

  // Playing phase
  if (phase === 'playing' && quizData) {
    return (
      <div>
        <QuizGame
          quizData={quizData}
          partnerName=""
          isUser1={true}
          isHost={true}
          solo={true}
          onAnswer={handleAnswer}
          onAdvance={handleAdvance}
          onGameEnd={(s1) => handleGameEnd(s1)}
        />
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={onBack}
            className="w-full text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
          >
            Quitter le quiz
          </button>
        </div>
      </div>
    )
  }

  // Done phase
  if (phase === 'done') {
    return (
      <div className="px-4 text-center py-8 space-y-5">
        <span className="text-6xl block">🏆</span>
        <p className="text-xl font-bold text-[var(--color-text)]">Quiz terminé !</p>
        <p className="text-4xl font-black text-[var(--color-accent)]">{finalScore}</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {correctCount}/{quizData?.questions.length ?? 10} bonnes réponses
        </p>
        {theme && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {THEME_LABELS[theme]}
            {themeValue ? ` — ${themeValue}` : ''}
            {difficulty ? ` • ${DIFFICULTY_LABELS[difficulty]}` : ''}
          </p>
        )}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => {
              setPhase('setup')
              setQuizData(null)
              setError(false)
            }}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            Rejouer
          </button>
          <button
            onClick={onBack}
            className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    )
  }

  return null
}
