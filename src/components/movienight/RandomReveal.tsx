import { useEffect, useState } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { LobbyFilm } from '../../hooks/useLobby'

interface Props {
  film1: LobbyFilm
  film2: LobbyFilm
  partnerName: string
  onDone: (winner: LobbyFilm) => void
}

export function RandomReveal({ film1, film2, partnerName, onDone }: Props) {
  const [phase, setPhase] = useState<'rolling' | 'result'>('rolling')
  const [current, setCurrent] = useState(0) // 0 = film1, 1 = film2
  const [winner, setWinner] = useState<LobbyFilm | null>(null)

  useEffect(() => {
    if (phase !== 'rolling') return

    // Alternate between films quickly, then slow down and stop
    let count = 0
    const totalSteps = 16
    let delay = 100

    function step() {
      setCurrent(c => 1 - c)
      count++

      if (count >= totalSteps) {
        // Pick winner
        const w = Math.random() > 0.5 ? film1 : film2
        setWinner(w)
        setCurrent(w === film1 ? 0 : 1)
        setPhase('result')
        return
      }

      delay = 100 + (count / totalSteps) * 400
      setTimeout(step, delay)
    }

    step()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const displayFilm = current === 0 ? film1 : film2

  if (phase === 'result' && winner) {
    return (
      <div className="px-4 text-center py-8 space-y-4">
        <span className="text-5xl block">🎲</span>
        <p className="text-lg font-bold text-[var(--color-text)]">Le sort a parlé !</p>

        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Ce soir on regarde :</p>
          <div className="w-24 h-36 mx-auto rounded-xl overflow-hidden shadow-lg mb-3">
            <img src={getPosterUrl(winner.poster_path, 'medium')} alt={winner.title} className="w-full h-full object-cover" />
          </div>
          <p className="font-bold text-[var(--color-text)]">{winner.title}</p>
          {winner.release_date && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {new Date(winner.release_date).getFullYear()}
            </p>
          )}
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Choix de {winner === film1 ? 'Toi' : partnerName}
          </p>
        </div>

        <button
          onClick={() => onDone(winner)}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          Bon film !
        </button>
      </div>
    )
  }

  // Rolling animation
  return (
    <div className="px-4 text-center py-12 space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">Le hasard décide…</p>
      <div className={`w-28 h-40 mx-auto rounded-xl overflow-hidden shadow-xl transition-transform ${phase === 'rolling' ? 'animate-pulse' : ''}`}>
        <img
          src={getPosterUrl(displayFilm.poster_path, 'medium')}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <p className="text-sm font-medium text-[var(--color-text)]">{displayFilm.title}</p>
    </div>
  )
}
