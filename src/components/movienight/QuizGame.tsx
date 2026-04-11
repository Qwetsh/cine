import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizData, QuizQuestion, FilmPoster } from '../../lib/quiz'
import { calculateScore } from '../../lib/quiz'
import { getPosterUrl, getBackdropUrl } from '../../lib/tmdb'
import { useSettings, BATTLE_COLORS } from '../../hooks/useSettings'

const QUESTION_TIMEOUT = 15_000
const REVEAL_DURATION = 3_000
const COUNTDOWN_SECONDS = 3

interface Props {
  quizData: QuizData
  partnerName: string
  isUser1: boolean
  isHost: boolean
  solo?: boolean
  onAnswer: (questionIndex: number, answerIndex: number, timeMs: number, score: number) => void
  onAdvance: (nextIndex: number, phase: QuizData['phase']) => void
  onGameEnd: (score1: number, score2: number) => void
}

export function QuizGame({
  quizData, partnerName, isUser1, isHost, solo = false,
  onAnswer, onAdvance, onGameEnd,
}: Props) {
  const { questions, current_index, phase, scores } = quizData
  const question = questions[current_index] as QuizQuestion | undefined

  const { settings } = useSettings()
  const myColor = BATTLE_COLORS.find(c => c.id === settings.battleColor) ?? BATTLE_COLORS[0]

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

    const shouldReveal = solo ? myAns != null : (myAns != null && partnerAns != null)
    if (shouldReveal) {
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
  }, [phase, myAnswers, partnerAnswers, current_index, isHost, solo, questions.length, onAdvance])

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
    const finalMyScore = isUser1 ? scores[0] : scores[1]

    if (solo) {
      const maxScore = questions.length * 200
      const correctCount = myAnswers.filter((a, i) => a === questions[i]?.correct_index).length
      return (
        <div className="px-4 text-center py-12 space-y-5">
          <span className="text-6xl block">🏆</span>
          <p className="text-xl font-bold text-[var(--color-text)]">Quiz terminé !</p>
          <div className="space-y-2">
            <p className="text-4xl font-black text-[var(--color-accent)]">{finalMyScore}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {correctCount}/{questions.length} bonnes réponses
            </p>
            <div className="w-48 mx-auto h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(finalMyScore / maxScore) * 100}%`,
                  background: myColor.gradient,
                }}
              />
            </div>
          </div>
        </div>
      )
    }

    const finalTheirScore = isUser1 ? scores[1] : scores[0]
    const winner = finalMyScore > finalTheirScore ? 'Toi'
      : finalTheirScore > finalMyScore ? partnerName
      : 'Égalité'
    const finalTotal = finalMyScore + finalTheirScore
    const finalPct = finalTotal > 0 ? (finalMyScore / finalTotal) * 100 : 50

    return (
      <div className="px-4 text-center py-12 space-y-5">
        <span className="text-6xl block">🏆</span>
        <p className="text-xl font-bold text-[var(--color-text)]">
          {winner === 'Égalité' ? 'Égalité !' : `${winner} gagne !`}
        </p>

        {/* Energy bar */}
        <div className="energy-bar-container">
          <div className="energy-bar">
            <div
              className="energy-bar__left"
              style={{
                width: `${finalPct}%`,
                background: myColor.gradient,
                boxShadow: `0 0 10px ${myColor.glow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
              }}
            />
            <div className="energy-bar__right" style={{ width: `${100 - finalPct}%` }} />
            <div className="energy-bar__clash" style={{ left: `${finalPct}%` }}>
              <div className="energy-bar__spark" />
              <div className="energy-bar__spark energy-bar__spark--2" />
              <div className="energy-bar__spark energy-bar__spark--3" />
              <div className="energy-bar__glow" />
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-8">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Toi</p>
            <p className="text-3xl font-bold text-[var(--color-accent)]">{finalMyScore}</p>
          </div>
          <div className="text-[var(--color-text-muted)] self-center text-lg">vs</div>
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">{partnerName}</p>
            <p className="text-3xl font-bold text-red-400">{finalTheirScore}</p>
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

  const myScoreQ = isUser1 ? scores[0] : scores[1]
  const theirScoreQ = isUser1 ? scores[1] : scores[0]
  const totalScoreQ = myScoreQ + theirScoreQ
  const myPct = totalScoreQ > 0 ? (myScoreQ / totalScoreQ) * 100 : 50

  // Determine question UI variant
  const usesPosterGrid = ['budget_compare', 'revenue_compare', 'which_came_first', 'odd_one_out'].includes(question.type)

  return (
    <div className="px-4 space-y-4">
      {/* Header */}
      {solo ? (
        <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
          <div className="text-center min-w-[60px]">
            <p className="text-[10px] text-[var(--color-text-muted)]">Score</p>
            <p className="text-xl font-bold text-[var(--color-accent)]">{myScoreQ}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-[var(--color-text-muted)] font-medium">
              {current_index + 1}/{questions.length}
            </span>
            <span className={`text-lg font-bold ${isLow ? 'text-red-400' : 'text-[var(--color-text)]'}`}>
              {seconds}s
            </span>
          </div>
          <div className="w-[60px]" />
        </div>
      ) : (
        <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
          <div className="text-center min-w-[60px]">
            <p className="text-[10px] text-[var(--color-text-muted)]">Toi</p>
            <p className="text-xl font-bold text-[var(--color-accent)]">{myScoreQ}</p>
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
            <p className="text-xl font-bold text-red-400">{theirScoreQ}</p>
          </div>
        </div>
      )}

      {/* Energy bar (duo only) */}
      {!solo && (
        <div className="energy-bar-container">
          <div className="energy-bar">
            <div
              className="energy-bar__left"
              style={{
                width: `${myPct}%`,
                background: myColor.gradient,
                boxShadow: `0 0 10px ${myColor.glow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
              }}
            />
            <div className="energy-bar__right" style={{ width: `${100 - myPct}%` }} />
            <div className="energy-bar__clash" style={{ left: `${myPct}%` }}>
              <div className="energy-bar__spark" />
              <div className="energy-bar__spark energy-bar__spark--2" />
              <div className="energy-bar__spark energy-bar__spark--3" />
              <div className="energy-bar__glow" />
            </div>
          </div>
        </div>
      )}

      {/* Question prompt area */}
      <QuestionPrompt
        question={question}
        timeLeft={timeLeft}
        revealed={showResult || myCurrentAnswer != null}
      />

      {/* Answer options */}
      {usesPosterGrid && question.film_posters ? (
        <PosterGrid
          posters={question.film_posters}
          options={question.options}
          correctIndex={question.correct_index}
          myAnswer={myCurrentAnswer}
          showResult={showResult}
          onAnswer={handleAnswer}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {question.options.map((option, idx) => {
            const { bg, textColor } = getOptionStyle(idx, question.correct_index, myCurrentAnswer, showResult)
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
      )}

      {/* Status line */}
      <div className="text-center text-xs text-[var(--color-text-muted)]">
        {!solo && myCurrentAnswer != null && partnerCurrentAnswer == null && (
          <span className="animate-pulse">En attente de {partnerName}...</span>
        )}
        {!solo && myCurrentAnswer == null && partnerCurrentAnswer != null && (
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

// ── Question prompt component (handles all visual variants) ──

function QuestionPrompt({
  question,
  timeLeft,
  revealed,
}: {
  question: QuizQuestion
  timeLeft: number
  revealed: boolean
}) {
  // Blurred poster
  if (question.type === 'poster' && question.poster_path) {
    return (
      <PosterQuestion
        posterPath={question.poster_path}
        timeLeft={timeLeft}
        revealed={revealed}
        filmTitle={question.source_film.title}
      />
    )
  }

  // Backdrop guess
  if (question.type === 'backdrop_guess' && question.backdrop_path) {
    return (
      <BackdropQuestion
        backdropPath={question.backdrop_path}
        revealed={revealed}
        filmTitle={question.source_film.title}
      />
    )
  }

  // Keywords pills
  if (question.type === 'keywords_to_movie' && question.keyword_pills) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 text-center">
        <p className="font-bold text-[var(--color-text)] leading-snug mb-3">{question.text}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {question.keyword_pills.map((kw, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-medium rounded-full border border-[var(--color-accent)]/30"
            >
              {kw}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Cast names
  if (question.type === 'cast_to_movie' && question.cast_names) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 text-center">
        <p className="font-bold text-[var(--color-text)] leading-snug mb-3">{question.text}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {question.cast_names.map((name, i) => (
            <span
              key={i}
              className="px-3 py-1.5 bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm font-medium rounded-xl border border-[var(--color-border)]"
            >
              🎭 {name}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Connect films (3 mini posters as prompt)
  if (question.type === 'connect_movies' && question.connect_films) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 text-center">
        <p className="font-bold text-[var(--color-text)] leading-snug mb-3">{question.text}</p>
        <div className="flex justify-center gap-3">
          {question.connect_films.map(film => (
            <div key={film.tmdb_id} className="w-16">
              <div className="w-16 h-24 rounded-lg overflow-hidden bg-[var(--color-surface-2)]">
                {film.poster_path ? (
                  <img
                    src={getPosterUrl(film.poster_path, 'small')}
                    alt={film.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">🎬</div>
                )}
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1 leading-tight truncate">{film.title}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Comparison questions with film posters (budget, revenue, first, odd_one_out)
  // The prompt is just the question text — posters are shown as answer options
  if (['budget_compare', 'revenue_compare', 'which_came_first', 'odd_one_out'].includes(question.type)) {
    return (
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 text-center">
        <p className="font-bold text-[var(--color-text)] leading-snug">{question.text}</p>
      </div>
    )
  }

  // Default text question
  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 text-center min-h-[100px] flex flex-col justify-center">
      <p className="font-bold text-[var(--color-text)] leading-snug">{question.text}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-2">
        🎬 {question.source_film.title}
      </p>
    </div>
  )
}

// ── Poster grid (for comparison questions) ──

function PosterGrid({
  posters,
  options,
  correctIndex,
  myAnswer,
  showResult,
  onAnswer,
}: {
  posters: FilmPoster[]
  options: string[]
  correctIndex: number
  myAnswer: number | null
  showResult: boolean
  onAnswer: (idx: number) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {options.map((title, idx) => {
        const poster = posters.find(p => p.title === title)
        const { bg, textColor } = getOptionStyle(idx, correctIndex, myAnswer, showResult)
        return (
          <button
            key={idx}
            onClick={() => onAnswer(idx)}
            disabled={myAnswer != null}
            className={`rounded-xl border p-2 transition-all ${bg}`}
          >
            <div className="w-full aspect-[2/3] rounded-lg overflow-hidden bg-[var(--color-surface-2)] mb-1.5">
              {poster?.poster_path ? (
                <img
                  src={getPosterUrl(poster.poster_path, 'small')}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
              )}
            </div>
            <p className={`text-xs font-medium leading-tight ${textColor} line-clamp-2`}>{title}</p>
          </button>
        )
      })}
    </div>
  )
}

// ── Shared style helper ──

function getOptionStyle(idx: number, correctIndex: number, myAnswer: number | null, showResult: boolean) {
  let bg = 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]'
  let textColor = 'text-[var(--color-text)]'

  if (showResult || myAnswer != null) {
    if (idx === correctIndex) {
      bg = 'bg-green-500/20 border-green-500/50'
      textColor = 'text-green-400'
    } else if (idx === myAnswer && idx !== correctIndex) {
      bg = 'bg-red-500/20 border-red-500/50'
      textColor = 'text-red-400'
    } else {
      bg = 'bg-[var(--color-surface)] border-[var(--color-border)] opacity-50'
    }
  } else if (idx === myAnswer) {
    bg = 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/50'
  }

  return { bg, textColor }
}

// ── Blurred poster component ──

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
  const [imageLoaded, setImageLoaded] = useState(false)

  const progress = 1 - (timeLeft / QUESTION_TIMEOUT)
  const blurPx = revealed ? 0 : Math.max(2, 20 * (1 - Math.sqrt(progress)))

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 text-center">
      <p className="text-sm font-bold text-[var(--color-text)] mb-3">Quel est ce film ?</p>
      <div className="relative w-36 h-52 mx-auto rounded-xl overflow-hidden shadow-lg bg-[var(--color-surface-2)]">
        <img
          src={getPosterUrl(posterPath, 'medium')}
          alt="Affiche mystère"
          onLoad={() => setImageLoaded(true)}
          className="w-full h-full object-cover"
          style={{
            filter: `blur(${imageLoaded ? blurPx : 40}px)`,
            opacity: imageLoaded ? 1 : 0,
            transition: 'filter 0.15s linear',
          }}
          draggable={false}
        />
        {(!imageLoaded || (!revealed && blurPx > 10)) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">🎬</span>
          </div>
        )}
      </div>
      {revealed && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2">{filmTitle}</p>
      )}
    </div>
  )
}

// ── Backdrop question component ──

function BackdropQuestion({
  backdropPath,
  revealed,
  filmTitle,
}: {
  backdropPath: string
  revealed: boolean
  filmTitle: string
}) {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 text-center">
      <p className="text-sm font-bold text-[var(--color-text)] mb-3">Quel est ce film ?</p>
      <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-[var(--color-surface-2)]">
        <img
          src={getBackdropUrl(backdropPath, 'medium')}
          alt="Image du film"
          onLoad={() => setImageLoaded(true)}
          className="w-full h-full object-cover"
          style={{
            opacity: imageLoaded ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
          draggable={false}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">📸</span>
          </div>
        )}
      </div>
      {revealed && (
        <p className="text-xs text-[var(--color-text-muted)] mt-2">{filmTitle}</p>
      )}
    </div>
  )
}
