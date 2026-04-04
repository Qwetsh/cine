import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizData, QuizQuestion } from '../../lib/quiz'
import { calculateScore } from '../../lib/quiz'
import { getPosterUrl } from '../../lib/tmdb'

const QUESTION_TIMEOUT = 15_000
const REVEAL_DURATION = 3_000
const COUNTDOWN_SECONDS = 3

interface Props {
  quizData: QuizData
  partnerName: string
  isUser1: boolean
  isHost: boolean
  onAnswer: (questionIndex: number, answerIndex: number, timeMs: number, score: number) => void
  onAdvance: (nextIndex: number, phase: QuizData['phase']) => void
  onGameEnd: (score1: number, score2: number) => void
}

export function QuizGame({
  quizData, partnerName, isUser1, isHost,
  onAnswer, onAdvance, onGameEnd,
}: Props) {
  const { questions, current_index, phase, scores } = quizData
  const question = questions[current_index] as QuizQuestion | undefined

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS)
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIMEOUT)
  const [myAnswer, setMyAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const questionStartRef = useRef(0)
  const answeredRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const myAnswers = isUser1 ? quizData.answers_user1 : quizData.answers_user2
  const partnerAnswers = isUser1 ? quizData.answers_user2 : quizData.answers_user1

  // Reset local state when question changes
  useEffect(() => {
    setMyAnswer(myAnswers[current_index] ?? null)
    setShowResult(false)
    answeredRef.current = myAnswers[current_index] != null
    if (quizData.question_started_at) {
      questionStartRef.current = new Date(quizData.question_started_at).getTime()
    }
  }, [current_index, myAnswers, quizData.question_started_at])

  // ── COUNTDOWN phase ──
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      if (isHost) onAdvance(0, 'question')
      return
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, isHost, onAdvance])

  // ── QUESTION timer ──
  useEffect(() => {
    if (phase !== 'question') return
    if (!quizData.question_started_at) return

    const start = new Date(quizData.question_started_at).getTime()
    questionStartRef.current = start

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, QUESTION_TIMEOUT - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(timerRef.current)
        // Auto-submit timeout if not answered
        if (!answeredRef.current) {
          answeredRef.current = true
          setMyAnswer(-1)
          onAnswer(current_index, -1, QUESTION_TIMEOUT, 0)
        }
      }
    }, 100)

    return () => clearInterval(timerRef.current)
  }, [phase, quizData.question_started_at, current_index, onAnswer])

  // ── REVEAL: both answered → show results, then advance ──
  useEffect(() => {
    if (phase !== 'question') return
    const myAns = myAnswers[current_index]
    const partnerAns = partnerAnswers[current_index]

    if (myAns != null && partnerAns != null) {
      setShowResult(true)
      if (timerRef.current) clearInterval(timerRef.current)

      if (isHost) {
        const timer = setTimeout(() => {
          const nextIdx = current_index + 1
          if (nextIdx >= questions.length) {
            onAdvance(current_index, 'results')
          } else {
            onAdvance(nextIdx, 'question')
          }
        }, REVEAL_DURATION)
        return () => clearTimeout(timer)
      }
    }
  }, [phase, myAnswers, partnerAnswers, current_index, isHost, questions.length, onAdvance])

  // ── RESULTS: trigger game end ──
  useEffect(() => {
    if (phase !== 'results') return
    const timer = setTimeout(() => {
      onGameEnd(scores[0], scores[1])
    }, 2000)
    return () => clearTimeout(timer)
  }, [phase, scores, onGameEnd])

  // Handle answer tap
  const handleAnswer = useCallback((answerIndex: number) => {
    if (answeredRef.current || phase !== 'question') return
    answeredRef.current = true

    const timeMs = Date.now() - questionStartRef.current
    const correct = question ? answerIndex === question.correct_index : false
    const pts = calculateScore(correct, timeMs)

    setMyAnswer(answerIndex)
    onAnswer(current_index, answerIndex, timeMs, pts)
  }, [phase, current_index, question, onAnswer])

  // ── COUNTDOWN RENDER ──
  if (phase === 'countdown') {
    return (
      <div className="px-4 flex flex-col items-center justify-center py-20">
        <p className="text-sm text-[var(--color-text-muted)] mb-4">Quiz Ciné !</p>
        <span className="text-8xl font-black text-[var(--color-accent)] animate-pulse">
          {countdown || 'GO !'}
        </span>
      </div>
    )
  }

  // ── RESULTS RENDER ──
  if (phase === 'results') {
    const winner = scores[0] > scores[1] ? (isUser1 ? 'Toi' : partnerName)
      : scores[1] > scores[0] ? (isUser1 ? partnerName : 'Toi')
      : 'Égalité'
    const myScore = isUser1 ? scores[0] : scores[1]
    const theirScore = isUser1 ? scores[1] : scores[0]

    return (
      <div className="px-4 text-center py-12 space-y-5">
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
      </div>
    )
  }

  // ── GENERATING RENDER ──
  if (phase === 'generating' || !question) {
    return (
      <div className="px-4 text-center py-16">
        <span className="text-5xl block mb-4 animate-pulse">🧠</span>
        <p className="text-sm text-[var(--color-text-muted)]">Génération des questions...</p>
      </div>
    )
  }

  // ── QUESTION RENDER ──
  const seconds = Math.ceil(timeLeft / 1000)
  const isLow = seconds <= 5
  const myCurrentAnswer = myAnswer
  const partnerCurrentAnswer = partnerAnswers[current_index]

  return (
    <div className="px-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
        <div className="text-center min-w-[60px]">
          <p className="text-[10px] text-[var(--color-text-muted)]">Toi</p>
          <p className="text-xl font-bold text-[var(--color-accent)]">{isUser1 ? scores[0] : scores[1]}</p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-[var(--color-text-muted)] font-medium">
            {current_index + 1}/{questions.length}
          </span>
          <span className={`text-lg font-bold ${isLow ? 'text-red-400' : 'text-[var(--color-text)]'}`}>
            {seconds}s
          </span>
        </div>

        <div className="text-center min-w-[60px]">
          <p className="text-[10px] text-[var(--color-text-muted)]">{partnerName}</p>
          <p className="text-xl font-bold text-red-400">{isUser1 ? scores[1] : scores[0]}</p>
        </div>
      </div>

      {/* Question */}
      {question.type === 'poster' && question.poster_path ? (
        <PosterQuestion
          posterPath={question.poster_path}
          timeLeft={timeLeft}
          revealed={showResult || myCurrentAnswer != null}
          filmTitle={question.source_film.title}
        />
      ) : (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 text-center min-h-[100px] flex flex-col justify-center">
          <p className="font-bold text-[var(--color-text)] leading-snug">{question.text}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            🎬 {question.source_film.title}
          </p>
        </div>
      )}

      {/* Answers 2×2 grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {question.options.map((option, idx) => {
          let bg = 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
          let textColor = 'text-[var(--color-text)]'

          if (showResult || myCurrentAnswer != null) {
            if (idx === question.correct_index) {
              bg = 'bg-green-500/20 border-green-500/50'
              textColor = 'text-green-400'
            } else if (idx === myCurrentAnswer && idx !== question.correct_index) {
              bg = 'bg-red-500/20 border-red-500/50'
              textColor = 'text-red-400'
            } else {
              bg = 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-50'
            }
          } else if (idx === myCurrentAnswer) {
            bg = 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50'
          }

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={myCurrentAnswer != null}
              className={`rounded-xl border p-3.5 text-sm font-medium transition-all ${bg} ${textColor}`}
            >
              {option}
            </button>
          )
        })}
      </div>

      {/* Status line */}
      <div className="text-center text-xs text-[var(--color-text-muted)]">
        {myCurrentAnswer != null && partnerCurrentAnswer == null && (
          <span className="animate-pulse">En attente de {partnerName}...</span>
        )}
        {myCurrentAnswer == null && partnerCurrentAnswer != null && (
          <span>{partnerName} a répondu !</span>
        )}
        {showResult && myCurrentAnswer != null && (
          <span>
            {myCurrentAnswer === question.correct_index ? '✓ Bonne réponse !' : '✗ Mauvaise réponse'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Blurred poster component ──

const QUESTION_TIMEOUT_MS = 15_000

function PosterQuestion({
  posterPath,
  timeLeft,
  revealed,
  filmTitle,
}: {
  posterPath: string
  timeLeft: number
  revealed: boolean
  filmTitle: string
}) {
  // Blur: starts at 20px, fast initial deblur then slows down (square root curve).
  // At 15s → 20px, at 7s → ~7px, at 3s → ~4px, at 0s → 2px
  const progress = 1 - (timeLeft / QUESTION_TIMEOUT_MS) // 0 → 1
  const blurPx = revealed
    ? 0
    : Math.max(2, 20 * (1 - Math.sqrt(progress)))

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 text-center">
      <p className="text-sm font-bold text-[var(--color-text)] mb-3">Quel est ce film ?</p>
      <div className="relative w-36 h-52 mx-auto rounded-xl overflow-hidden shadow-lg">
        <img
          src={getPosterUrl(posterPath, 'medium')}
          alt="Affiche mystère"
          className="w-full h-full object-cover transition-[filter] duration-300"
          style={{ filter: `blur(${blurPx}px)` }}
          draggable={false}
        />
        {!revealed && blurPx > 10 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">🎬</span>
          </div>
        )}
      </div>
      {revealed && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          {filmTitle}
        </p>
      )}
    </div>
  )
}
