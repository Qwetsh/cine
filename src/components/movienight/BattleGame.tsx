import { useCallback, useEffect, useRef, useState } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { LobbyFilm } from '../../hooks/useLobby'

const GAME_DURATION = 10_000 // 10 seconds
const TARGET_INTERVAL_MIN = 400
const TARGET_INTERVAL_MAX = 900
const TARGET_LIFETIME = 1200

interface Target {
  id: number
  x: number
  y: number
  createdAt: number
}

interface Props {
  film1: LobbyFilm
  film2: LobbyFilm
  partnerName: string
  partnerScore: number
  isUser1: boolean
  onScoreUpdate: (score: number) => void
  onGameEnd: (myScore: number) => void
}

export function BattleGame({
  film1, film2, partnerName, partnerScore, isUser1, onScoreUpdate, onGameEnd,
}: Props) {
  const [phase, setPhase] = useState<'countdown' | 'playing' | 'finished'>('countdown')
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [targets, setTargets] = useState<Target[]>([])
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [result, setResult] = useState<{ winner: 'me' | 'partner' | 'tie'; winnerFilm: LobbyFilm } | null>(null)

  const scoreRef = useRef(0)
  const targetIdRef = useRef(0)
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number | undefined>(undefined)
  const targetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const gameStartRef = useRef(0)

  // Countdown
  useEffect(() => {
    if (phase !== 'countdown') return
    if (countdown <= 0) {
      setPhase('playing')
      return
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [phase, countdown])

  // Spawn targets
  const spawnTarget = useCallback(() => {
    if (!gameAreaRef.current) return
    const rect = gameAreaRef.current.getBoundingClientRect()
    const padding = 30
    const x = padding + Math.random() * (rect.width - padding * 2)
    const y = padding + Math.random() * (rect.height - padding * 2)
    const id = ++targetIdRef.current

    setTargets(prev => [...prev, { id, x, y, createdAt: Date.now() }])

    // Remove target after lifetime
    setTimeout(() => {
      setTargets(prev => prev.filter(t => t.id !== id))
    }, TARGET_LIFETIME)
  }, [])

  // Game loop
  useEffect(() => {
    if (phase !== 'playing') return

    gameStartRef.current = Date.now()

    // Spawn targets at random intervals
    function scheduleNext() {
      const delay = TARGET_INTERVAL_MIN + Math.random() * (TARGET_INTERVAL_MAX - TARGET_INTERVAL_MIN)
      targetTimerRef.current = setTimeout(() => {
        if (Date.now() - gameStartRef.current < GAME_DURATION) {
          spawnTarget()
          scheduleNext()
        }
      }, delay)
    }

    spawnTarget() // first target immediately
    scheduleNext()

    // Time tracking
    function tick() {
      const elapsed = Date.now() - gameStartRef.current
      const remaining = Math.max(0, GAME_DURATION - elapsed)
      setTimeLeft(remaining)

      if (remaining <= 0) {
        setPhase('finished')
        return
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (targetTimerRef.current) clearTimeout(targetTimerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [phase, spawnTarget])

  // When game finishes
  useEffect(() => {
    if (phase !== 'finished') return

    // Small delay to let partner score sync
    const timer = setTimeout(() => {
      const myScore = scoreRef.current
      const theirScore = partnerScore
      let winner: 'me' | 'partner' | 'tie'
      let winnerFilm: LobbyFilm

      if (myScore > theirScore) {
        winner = 'me'
        winnerFilm = isUser1 ? film1 : film2
      } else if (theirScore > myScore) {
        winner = 'partner'
        winnerFilm = isUser1 ? film2 : film1
      } else {
        // Tie → random
        winner = 'tie'
        winnerFilm = Math.random() > 0.5 ? film1 : film2
      }

      setResult({ winner, winnerFilm })
      onGameEnd(myScore)
    }, 1500)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function handleTap(targetId: number) {
    setTargets(prev => prev.filter(t => t.id !== targetId))
    const newScore = scoreRef.current + 1
    scoreRef.current = newScore
    setScore(newScore)
    onScoreUpdate(newScore)
  }

  // Progress bar
  const myProgress = score / (score + partnerScore || 1)
  const totalScore = score + partnerScore

  // Countdown screen
  if (phase === 'countdown') {
    return (
      <div className="px-4 flex flex-col items-center justify-center py-20">
        <p className="text-sm text-[var(--color-text-muted)] mb-4">Prépare-toi !</p>
        <span className="text-7xl font-bold text-[var(--color-accent)] animate-pulse">
          {countdown || 'GO !'}
        </span>
        <p className="text-xs text-[var(--color-text-muted)] mt-6">
          Tape les cibles le plus vite possible !
        </p>
      </div>
    )
  }

  // Result screen
  if (result) {
    return (
      <div className="px-4 text-center py-8 space-y-4">
        <span className="text-5xl block">
          {result.winner === 'me' ? '🏆' : result.winner === 'partner' ? '😅' : '🤝'}
        </span>
        <p className="text-lg font-bold text-[var(--color-text)]">
          {result.winner === 'me'
            ? 'Tu as gagné !'
            : result.winner === 'partner'
            ? `${partnerName} a gagné !`
            : 'Égalité ! Le hasard a tranché'}
        </p>
        <div className="flex justify-center gap-6 text-sm text-[var(--color-text-muted)]">
          <span>Toi : <strong className="text-[var(--color-text)]">{score}</strong></span>
          <span>{partnerName} : <strong className="text-[var(--color-text)]">{partnerScore}</strong></span>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 mt-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Ce soir on regarde :</p>
          <div className="w-24 h-36 mx-auto rounded-xl overflow-hidden shadow-lg mb-3">
            <img src={getPosterUrl(result.winnerFilm.poster_path, 'medium')} alt={result.winnerFilm.title} className="w-full h-full object-cover" />
          </div>
          <p className="font-bold text-[var(--color-text)]">{result.winnerFilm.title}</p>
        </div>
      </div>
    )
  }

  // Playing screen
  return (
    <div className="px-4 space-y-3">
      {/* Timer */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          {Math.ceil(timeLeft / 1000)}s
        </span>
        <div className="flex-1 mx-3 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-100"
            style={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }}
          />
        </div>
        <span className="text-xs font-bold text-[var(--color-text)]">{score}</span>
      </div>

      {/* Score bar (me vs partner) */}
      {totalScore > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)] w-8 text-right">{score}</span>
          <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden flex">
            <div
              className="h-full bg-[var(--color-accent)] transition-all duration-200"
              style={{ width: `${myProgress * 100}%` }}
            />
            <div
              className="h-full bg-red-400 transition-all duration-200"
              style={{ width: `${(1 - myProgress) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-text-muted)] w-8">{partnerScore}</span>
        </div>
      )}

      {/* Game area */}
      <div
        ref={gameAreaRef}
        className="relative bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden select-none"
        style={{ height: '350px', touchAction: 'manipulation' }}
      >
        {targets.map(target => (
          <button
            key={target.id}
            onClick={() => handleTap(target.id)}
            className="absolute w-12 h-12 -ml-6 -mt-6 rounded-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] active:scale-90 transition-transform shadow-lg flex items-center justify-center animate-ping-once"
            style={{ left: target.x, top: target.y }}
          >
            <span className="text-xl">🎯</span>
          </button>
        ))}
        {targets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-[var(--color-text-muted)] animate-pulse">Prépare-toi…</p>
          </div>
        )}
      </div>
    </div>
  )
}
