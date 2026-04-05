import type { TournamentGameState } from '../../lib/tournament-board'
import { TournamentHP } from './TournamentHP'

interface Props {
  gameState: TournamentGameState
  isUser1: boolean
  partnerName: string
  onDismiss: () => void
}

export function TournamentResults({ gameState, isUser1, partnerName, onDismiss }: Props) {
  const myHp = isUser1 ? gameState.hp_p1 : gameState.hp_p2
  const theirHp = isUser1 ? gameState.hp_p2 : gameState.hp_p1
  const iWon = (isUser1 && gameState.winner === 'p1') || (!isUser1 && gameState.winner === 'p2')

  const reasonText = {
    hp_zero: iWon ? 'L\'adversaire a perdu tous ses PV !' : 'Tu as perdu tous tes PV…',
    fight_won: iWon ? 'Tu as gagné le combat central !' : 'L\'adversaire a gagné le combat…',
    fight_sudden_death: iWon ? 'Victoire en mort subite !' : 'Défaite en mort subite…',
  }

  return (
    <div className="px-4 text-center py-8 space-y-5">
      <span className="text-6xl block">{iWon ? '🏆' : '💀'}</span>
      <p className="text-xl font-bold text-[var(--color-text)]">
        {iWon ? 'Victoire !' : 'Défaite…'}
      </p>
      {gameState.win_reason && (
        <p className="text-sm text-[var(--color-text-muted)]">
          {reasonText[gameState.win_reason]}
        </p>
      )}

      <div className="flex justify-center gap-8 py-2">
        <div className="text-center">
          <TournamentHP current={myHp} max={gameState.max_hp} label="Toi" />
        </div>
        <div className="text-[var(--color-text-muted)] self-center text-lg">vs</div>
        <div className="text-center">
          <TournamentHP current={theirHp} max={gameState.max_hp} label={partnerName} />
        </div>
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)] space-y-1">
        <p>Tours joués : {gameState.turn_number}</p>
        {gameState.center_bonus_p1 > 0 || gameState.center_bonus_p2 > 0 ? (
          <p>
            PV bonus centre : Toi +{isUser1 ? gameState.center_bonus_p1 : gameState.center_bonus_p2},
            {' '}{partnerName} +{isUser1 ? gameState.center_bonus_p2 : gameState.center_bonus_p1}
          </p>
        ) : null}
      </div>

      <button
        onClick={onDismiss}
        className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
      >
        Terminer
      </button>
    </div>
  )
}
