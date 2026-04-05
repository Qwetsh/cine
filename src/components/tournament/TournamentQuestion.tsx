import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '../../lib/quiz'
import { getPosterUrl } from '../../lib/tmdb'

const QUESTION_TIMEOUT = 15_000

interface Props {
  question: QuizQuestion
  isMyTurn: boolean
  onAnswer: (answerIndex: number, timeMs: number) => void
  questionStartedAt: string | null
}

export function TournamentQuestion({
  question,
  isMyTurn,
  onAnswer,
  questionStartedAt,
}: Props) {
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMEOUT)
  const [myAnswer, setMyAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const startRef = useRef(0)
  const answeredRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const onAnswerRef = useRef(onAnswer)
  const isMyTurnRef = useRef(isMyTurn)
  onAnswerRef.current = onAnswer
  isMyTurnRef.current = isMyTurn

  // Reset on new question
  useEffect(() => {
    setMyAnswer(null)
    setShowResult(false)
    answeredRef.current = false
    setTimeLeft(QUESTION_TIMEOUT)

    if (!questionStartedAt) return
    const start = new Date(questionStartedAt).getTime()
    startRef.current = start

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, QUESTION_TIMEOUT - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(timerRef.current)
        if (!answeredRef.current && isMyTurnRef.current) {
          answeredRef.current = true
          setMyAnswer(-1)
          setShowResult(true)
          onAnswerRef.current(-1, QUESTION_TIMEOUT)
        }
      }
    }, 100)

    return () => clearInterval(timerRef.current)
  }, [question.id, questionStartedAt])

  const handleAnswer = useCallback((idx: number) => {
    if (answeredRef.current || !isMyTurnRef.current) return
    answeredRef.current = true
    const timeMs = Date.now() - startRef.current
    setMyAnswer(idx)
    setShowResult(true)
    if (timerRef.current) clearInterval(timerRef.current)
    onAnswerRef.current(idx, timeMs)
  }, [])

  const seconds = Math.ceil(timeLeft / 1000)
  const isLow = seconds <= 5

  // Poster blur for poster questions
  const isPoster = question.type === 'poster' && question.poster_path
  const progress = 1 - (timeLeft / QUESTION_TIMEOUT)
  const blurPx = showResult ? 0 : Math.max(2, 20 * (1 - Math.sqrt(progress)))

  return (
    <div className="px-4 space-y-3">
      {/* Timer */}
      <div className="flex justify-center">
        <span className={`text-lg font-bold ${isLow ? 'text-red-400 animate-pulse' : 'text-[var(--color-text)]'}`}>
          {seconds}s
        </span>
      </div>

      {/* Question */}
      {isPoster ? (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 text-center">
          <p className="text-sm font-bold text-[var(--color-text)] mb-3">Quel est ce film ?</p>
          <div className="relative w-36 h-52 mx-auto rounded-xl overflow-hidden shadow-lg bg-[var(--color-surface-2)]">
            <img
              src={getPosterUrl(question.poster_path!, 'medium')}
              alt="Affiche mystère"
              className="w-full h-full object-cover"
              style={{
                filter: `blur(${blurPx}px)`,
                transition: 'filter 0.15s linear',
              }}
              draggable={false}
            />
          </div>
          {showResult && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">{question.source_film.title}</p>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 text-center min-h-[80px] flex flex-col justify-center">
          <p className="font-bold text-[var(--color-text)] leading-snug text-sm">{question.text}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            🎬 {question.source_film.title}
          </p>
        </div>
      )}

      {/* Answers 2×2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {question.options.map((option, idx) => {
          let bg = 'bg-[var(--color-surface)] border-[var(--color-border)]'
          let textColor = 'text-[var(--color-text)]'

          if (showResult) {
            if (idx === question.correct_index) {
              bg = 'bg-green-500/20 border-green-500/50'
              textColor = 'text-green-400'
            } else if (idx === myAnswer && idx !== question.correct_index) {
              bg = 'bg-red-500/20 border-red-500/50'
              textColor = 'text-red-400'
            } else {
              bg = 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-50'
            }
          }

          const isDisabled = !isMyTurn || myAnswer != null

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={isDisabled}
              className={`relative rounded-xl border p-3 text-sm font-medium transition-all ${bg} ${textColor} ${
                !isMyTurn ? 'cursor-not-allowed' : ''
              }`}
            >
              {option}
              {/* Lock icon for spectator */}
              {!isMyTurn && !showResult && (
                <span className="absolute top-1 right-1 text-[10px] opacity-40">🔒</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Status */}
      {!isMyTurn && !showResult && (
        <p className="text-center text-xs text-[var(--color-text-muted)] animate-pulse">
          C'est le tour de l'adversaire…
        </p>
      )}
      {showResult && myAnswer != null && (
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          {myAnswer === question.correct_index ? '✓ Bonne réponse !' : '✗ Mauvaise réponse — -1 PV'}
        </p>
      )}
    </div>
  )
}
