import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuizQuestion } from '../../lib/quiz'
import type { FightState } from '../../lib/tournament-board'
import { TournamentHP } from './TournamentHP'
import { useSettings, BATTLE_COLORS } from '../../hooks/useSettings'

const FIGHT_TIMEOUT = 10_000 // 10s per question (shorter than board)

interface Props {
  fight: FightState
  questions: QuizQuestion[]
  hpP1: number
  hpP2: number
  maxHp: number
  isUser1: boolean
  partnerName: string
  onAnswer: (answerIndex: number, timeMs: number) => void
}

export function TournamentFight({
  fight,
  questions,
  hpP1,
  hpP2,
  maxHp,
  isUser1,
  partnerName,
  onAnswer,
}: Props) {
  const { settings } = useSettings()
  const myColor = BATTLE_COLORS.find(c => c.id === settings.battleColor) ?? BATTLE_COLORS[0]

  const [timeLeft, setTimeLeft] = useState(FIGHT_TIMEOUT)
  const [myAnswer, setMyAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const startRef = useRef(0)
  const answeredRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const question = fight.question_index != null ? questions[fight.question_index] : null
  const isMyTurn = (isUser1 && fight.current_answerer === 'p1') ||
                   (!isUser1 && fight.current_answerer === 'p2')

  const myHp = isUser1 ? hpP1 : hpP2
  const theirHp = isUser1 ? hpP2 : hpP1
  const totalHp = myHp + theirHp
  const myPct = totalHp > 0 ? (myHp / totalHp) * 100 : 50

  // Timer for each fight question
  useEffect(() => {
    if (!question) return
    setMyAnswer(null)
    setShowResult(false)
    answeredRef.current = false
    setTimeLeft(FIGHT_TIMEOUT)

    const start = Date.now()
    startRef.current = start

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, FIGHT_TIMEOUT - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(timerRef.current)
        if (!answeredRef.current && isMyTurn) {
          answeredRef.current = true
          setMyAnswer(-1)
          setShowResult(true)
          onAnswer(-1, FIGHT_TIMEOUT)
        }
      }
    }, 100)

    return () => clearInterval(timerRef.current)
  }, [fight.round, fight.current_answerer, question?.id, isMyTurn, onAnswer])

  const handleAnswer = useCallback((idx: number) => {
    if (answeredRef.current || !isMyTurn) return
    answeredRef.current = true
    const timeMs = Date.now() - startRef.current
    setMyAnswer(idx)
    setShowResult(true)
    if (timerRef.current) clearInterval(timerRef.current)
    onAnswer(idx, timeMs)
  }, [isMyTurn, onAnswer])

  if (!question) {
    return (
      <div className="px-4 text-center py-12">
        <span className="text-6xl block mb-4 animate-pulse">⚔️</span>
        <p className="text-lg font-bold text-[var(--color-text)]">FIGHT !</p>
      </div>
    )
  }

  const seconds = Math.ceil(timeLeft / 1000)
  const isLow = seconds <= 3

  return (
    <div className="px-4 space-y-3">
      {/* Header: HP + Round */}
      <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
        <TournamentHP current={myHp} max={maxHp} label="Toi" />
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            Round {fight.round}/{fight.max_rounds}
          </span>
          <span className={`text-lg font-bold ${isLow ? 'text-red-400 animate-pulse' : 'text-[var(--color-text)]'}`}>
            {seconds}s
          </span>
        </div>
        <TournamentHP current={theirHp} max={maxHp} label={partnerName} />
      </div>

      {/* Energy bar */}
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

      {/* Turn indicator */}
      <div className="text-center">
        <span className={`text-xs font-medium px-3 py-1 rounded-full ${
          isMyTurn
            ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
        }`}>
          {isMyTurn ? '⚡ C\'est ton tour !' : `${partnerName} répond…`}
        </span>
      </div>

      {/* Question */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 text-center">
        <p className="font-bold text-[var(--color-text)] leading-snug text-sm">{question.text}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">🎬 {question.source_film.title}</p>
      </div>

      {/* Answers */}
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

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={!isMyTurn || myAnswer != null}
              className={`relative rounded-xl border p-3 text-sm font-medium transition-all ${bg} ${textColor}`}
            >
              {option}
              {!isMyTurn && !showResult && (
                <span className="absolute top-1 right-1 text-[10px] opacity-40">🔒</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
