import { useCoupleContext } from '../../contexts/CoupleContext'
import { useAuth } from '../../contexts/AuthContext'
import { useLobby } from '../../hooks/useLobby'
import { getPosterUrl } from '../../lib/tmdb'
import { LobbyPicking } from './LobbyPicking'
import { LobbyReveal } from './LobbyReveal'
import { RandomReveal } from './RandomReveal'
import { BattleGame } from './BattleGame'
import type { LobbyFilm } from '../../hooks/useLobby'

export function DuelMode() {
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const lobby = useLobby(coupleId, user?.id ?? null, isUser1)

  const partnerName = partner?.display_name ?? 'Partenaire'

  if (!coupleId) {
    return (
      <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
        <span className="text-5xl mb-4">💑</span>
        <p className="font-medium">Liez vos comptes d'abord</p>
        <p className="text-sm mt-1">Le duel nécessite un couple configuré</p>
      </div>
    )
  }

  if (lobby.loading) {
    return (
      <div className="px-4 py-8">
        <div className="h-40 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
      </div>
    )
  }

  // No active lobby → create one
  if (!lobby.lobby) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-6xl block">⚔️</span>
        <p className="text-[var(--color-text)] font-medium">Duel Ciné</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Chacun choisit un film en secret,<br />puis le sort ou un mini-jeu décide !
        </p>
        <button
          onClick={lobby.create}
          className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-8 py-3 rounded-xl font-medium text-sm transition-colors"
        >
          Lancer un duel
        </button>
      </div>
    )
  }

  const { film_user1, film_user2, status, mode, winner_film, score_user1, score_user2 } = lobby.lobby

  // Phase: done → show winner
  if (status === 'done' && winner_film) {
    const isBattle = mode === 'battle'
    return (
      <div className="px-4 text-center py-8 space-y-5">
        <span className="text-6xl block">🏆</span>
        <p className="text-lg font-bold text-[var(--color-text)]">
          Ce soir on regarde :
        </p>

        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5">
          <div className="w-28 h-40 mx-auto rounded-xl overflow-hidden shadow-xl mb-3">
            <img src={getPosterUrl(winner_film.poster_path, 'medium')} alt={winner_film.title} className="w-full h-full object-cover" />
          </div>
          <p className="font-bold text-lg text-[var(--color-text)]">{winner_film.title}</p>
          {winner_film.release_date && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              {new Date(winner_film.release_date).getFullYear()}
            </p>
          )}
        </div>

        {isBattle && (
          <div className="flex justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="text-[var(--color-text-muted)] text-xs">Toi</p>
              <p className="font-bold text-xl text-[var(--color-text)]">{isUser1 ? score_user1 : score_user2}</p>
            </div>
            <div className="text-[var(--color-text-muted)] self-center text-lg">vs</div>
            <div className="text-center">
              <p className="text-[var(--color-text-muted)] text-xs">{partnerName}</p>
              <p className="font-bold text-xl text-[var(--color-text)]">{isUser1 ? score_user2 : score_user1}</p>
            </div>
          </div>
        )}

        {mode === 'random' && film_user1 && film_user2 && (
          <div className="flex justify-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span>Toi : {(isUser1 ? film_user1 : film_user2).title}</span>
            <span>·</span>
            <span>{partnerName} : {(isUser1 ? film_user2 : film_user1).title}</span>
          </div>
        )}

        <button
          onClick={lobby.dismiss}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          Bon film !
        </button>
      </div>
    )
  }

  // Phase: picking films
  if (status === 'picking') {
    return (
      <LobbyPicking
        myFilm={lobby.myFilm ?? null}
        partnerFilm={lobby.partnerFilm ?? null}
        partnerName={partnerName}
        onSubmit={lobby.submitFilm}
        onCancel={lobby.cancel}
      />
    )
  }

  // Phase: both films ready → choose mode
  if (status === 'ready' && film_user1 && film_user2) {
    if (mode === 'random') {
      return (
        <RandomReveal
          film1={film_user1}
          film2={film_user2}
          partnerName={partnerName}
          onDone={(winner) => lobby.setWinner(winner)}
        />
      )
    }

    return (
      <LobbyReveal
        film1={film_user1}
        film2={film_user2}
        partnerName={partnerName}
        onChooseMode={lobby.chooseMode}
        onCancel={lobby.cancel}
      />
    )
  }

  // Phase: battle minigame
  if (status === 'battle' && film_user1 && film_user2) {
    const partnerScore = isUser1 ? lobby.lobby.score_user2 : lobby.lobby.score_user1

    return (
      <BattleGame
        film1={film_user1}
        film2={film_user2}
        partnerName={partnerName}
        partnerScore={partnerScore}
        isUser1={isUser1}
        onScoreUpdate={lobby.updateScore}
        onGameEnd={(myScore) => {
          const theirScore = partnerScore
          let winnerFilm: LobbyFilm
          if (myScore > theirScore) {
            winnerFilm = isUser1 ? film_user1 : film_user2
          } else if (theirScore > myScore) {
            winnerFilm = isUser1 ? film_user2 : film_user1
          } else {
            winnerFilm = Math.random() > 0.5 ? film_user1 : film_user2
          }
          const s1 = isUser1 ? myScore : theirScore
          const s2 = isUser1 ? theirScore : myScore
          lobby.setWinner(winnerFilm, s1, s2)
        }}
      />
    )
  }

  return null
}
