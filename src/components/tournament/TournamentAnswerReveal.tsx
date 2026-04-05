import { useEffect, useState } from 'react'
import { TournamentHP } from './TournamentHP'

interface Props {
  isCorrect: boolean
  correctAnswer: string
  myHp: number
  theirHp: number
  maxHp: number
  partnerName: string
  filmTitle: string
}

export function TournamentAnswerReveal({ isCorrect, correctAnswer, myHp, theirHp, maxHp, partnerName, filmTitle }: Props) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setShow(true))
  }, [])

  if (isCorrect) {
    return (
      <div className={`px-4 text-center py-8 space-y-4 transition-all duration-500 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
        {/* Golden glow background */}
        <div className="relative inline-block">
          <div className="oscar-glow" />
          <span className="text-6xl block relative z-10 oscar-trophy">🏆</span>
        </div>
        <p className="text-xl font-bold text-yellow-400 oscar-shimmer">Bonne réponse !</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          {correctAnswer}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          🎬 {filmTitle}
        </p>
        <TournamentHP hpP1={myHp} hpP2={theirHp} maxHp={maxHp} nameP1="Toi" nameP2={partnerName} />
        {/* Sparkle particles */}
        <div className="oscar-particles" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="oscar-particle"
              style={{
                '--delay': `${i * 0.15}s`,
                '--x': `${(Math.random() - 0.5) * 200}px`,
                '--y': `${-40 - Math.random() * 120}px`,
                '--rotation': `${Math.random() * 360}deg`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`px-4 text-center py-8 space-y-4 transition-all duration-500 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
      <div className="relative inline-block">
        <span className="text-6xl block defeat-shake">���</span>
      </div>
      <p className="text-xl font-bold text-red-400">Mauvaise réponse</p>
      <p className="text-sm text-[var(--color-text)]">
        {correctAnswer}
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        🎬 {filmTitle}
      </p>
      <p className="text-sm text-red-400 font-medium">-1 PV</p>
      <TournamentHP current={myHp} max={maxHp} label="Tes PV" />
      {/* Rain effect */}
      <div className="defeat-rain" aria-hidden="true">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="rain-drop"
            style={{
              '--delay': `${Math.random() * 1.5}s`,
              '--x': `${Math.random() * 100}%`,
              '--duration': `${0.6 + Math.random() * 0.4}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </div>
  )
}
