import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCoupleContext } from '../../contexts/CoupleContext'
import { useTournament } from '../../hooks/useTournament'
import {
  generateBoardStructure,
  fillBoardQuestions,
  createInitialGameState,
  getNextMoves,
  STARTING_HP,
  CENTER_BONUS_MAX,
} from '../../lib/tournament-board'
import type { TournamentBoard, TournamentGameState, FightState } from '../../lib/tournament-board'
import { generateTournamentQuestions } from '../../lib/tournament-questions'
import type { QuizDifficulty } from '../../lib/discover'

const DIFFICULTY_OPTIONS: { id: QuizDifficulty; label: string; emoji: string }[] = [
  { id: 'easy', label: 'Facile', emoji: '🟢' },
  { id: 'normal', label: 'Normal', emoji: '🟡' },
  { id: 'hard', label: 'Difficile', emoji: '🔴' },
]
import { TournamentBoardView } from './TournamentBoard'
import { TournamentHP } from './TournamentHP'
import { TournamentQuestion } from './TournamentQuestion'
import { TournamentFight } from './TournamentFight'
import { TournamentAnswerReveal } from './TournamentAnswerReveal'
import { TournamentResults } from './TournamentResults'

const REVEAL_DELAY = 2500 // ms to show answer before advancing

export function TournamentMode() {
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const tournament = useTournament(coupleId, user?.id ?? null)

  const partnerName = partner?.display_name ?? 'Partenaire'
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [partnerLeft, setPartnerLeft] = useState(false)
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('normal')
  const prevSessionRef = useRef(tournament.session)
  const generatingRef = useRef(false)

  // Detect partner leaving
  useEffect(() => {
    const prev = prevSessionRef.current
    if (prev && !tournament.session && prev.status !== 'done') {
      setPartnerLeft(true)
    }
    prevSessionRef.current = tournament.session
  }, [tournament.session])

  // ── No couple ──
  if (!coupleId) {
    return (
      <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
        <span className="text-5xl mb-4">💑</span>
        <p className="font-medium">Liez vos comptes d'abord</p>
      </div>
    )
  }

  if (tournament.loading) {
    return (
      <div className="px-4 py-8">
        <div className="h-40 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
      </div>
    )
  }

  // Partner left
  if (partnerLeft && !tournament.session) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">👋</span>
        <p className="text-[var(--color-text)] font-medium">{partnerName} a quitté le tournoi</p>
        <button
          onClick={() => setPartnerLeft(false)}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          OK
        </button>
      </div>
    )
  }

  // ── No session → create ──
  if (!tournament.session) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-6xl block">🗺️</span>
        <p className="text-[var(--color-text)] font-medium">Tournoi Ciné</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Parcourez un plateau de jeu, répondez aux questions,<br />
          et affrontez-vous au centre !
        </p>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)] space-y-1 text-left">
          <p>🗺️ Plateau généré aléatoirement</p>
          <p>❤️ {STARTING_HP} PV — mauvaise réponse = -1 PV</p>
          <p>⚔️ Fight final au centre</p>
          <p>🎭 Rues thématiques (acteurs, réals, pays…)</p>
        </div>
        {/* Difficulty selector */}
        <div className="flex gap-2">
          {DIFFICULTY_OPTIONS.map(d => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={[
                'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all',
                difficulty === d.id
                  ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              {d.emoji} {d.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => tournament.create(difficulty)}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
        >
          Créer un tournoi
        </button>
      </div>
    )
  }

  const { session } = tournament
  const isCreator = session.created_by === user?.id

  // ── Waiting for partner ──
  if (session.status === 'waiting') {
    if (isCreator) {
      return (
        <div className="px-4 text-center py-12 space-y-4">
          <span className="text-5xl block">🗺️</span>
          <p className="text-[var(--color-text)] font-medium">Tournoi Ciné</p>
          <div className="animate-pulse">
            <span className="text-3xl">⏳</span>
          </div>
          {session.difficulty && session.difficulty !== 'normal' && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {session.difficulty === 'easy' ? '🟢 Facile' : '🔴 Difficile'}
            </p>
          )}
          <p className="text-sm text-[var(--color-text-muted)]">
            En attente de {partnerName}…
          </p>
          <button
            onClick={tournament.cancel}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Annuler
          </button>
        </div>
      )
    }

    // Partner sees invite
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">🗺️</span>
        <p className="text-[var(--color-text)] font-medium">
          {partnerName} te lance un Tournoi !
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Plateau de jeu ciné — {STARTING_HP} PV chacun
          {session.difficulty && session.difficulty !== 'normal'
            ? ` — ${session.difficulty === 'easy' ? '🟢 Facile' : '🔴 Difficile'}`
            : ''}
        </p>
        <button
          onClick={() => tournament.updateStatus('generating')}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
        >
          Rejoindre le tournoi !
        </button>
        <button
          onClick={tournament.cancel}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
        >
          Refuser
        </button>
      </div>
    )
  }

  // ── Generating board ──
  if (session.status === 'generating') {
    return (
      <GeneratingPhase
        tournament={tournament}
        isUser1={isUser1}
        generatingRef={generatingRef}
      />
    )
  }

  // ── Done → results ──
  if (session.status === 'done') {
    return (
      <TournamentResults
        gameState={session.game_state}
        isUser1={isUser1}
        partnerName={partnerName}
        onDismiss={tournament.dismiss}
      />
    )
  }

  // ── Playing / Center Fight ──
  return (
    <PlayingPhase
      tournament={tournament}
      isUser1={isUser1}
      partnerName={partnerName}
      confirmQuit={confirmQuit}
      setConfirmQuit={setConfirmQuit}
    />
  )
}

// ── Generating Phase ──

function GeneratingPhase({
  tournament,
  isUser1,
  generatingRef,
}: {
  tournament: ReturnType<typeof useTournament>
  isUser1: boolean
  generatingRef: React.RefObject<boolean>
}) {
  useEffect(() => {
    if (!isUser1 || generatingRef.current || !tournament.session) return
    if (tournament.session.status !== 'generating') return
    generatingRef.current = true

    async function generate() {
      try {
        const { board: boardStructure, questionSlotCount, streetThemes } = generateBoardStructure()
        const sessionDifficulty = (tournament.session!.difficulty as QuizDifficulty) ?? 'normal'
        const { questions, fightQuestions } = await generateTournamentQuestions(
          streetThemes,
          questionSlotCount,
          undefined,
          sessionDifficulty,
        )
        const board = fillBoardQuestions(boardStructure, questions, fightQuestions)
        const gameState = createInitialGameState(board)
        await tournament.setBoard(board, gameState)
      } catch (err) {
        console.error('Tournament generation error:', err)
      }
    }

    generate()
  }, [isUser1, tournament, generatingRef])

  return (
    <div className="px-4 text-center py-16">
      <span className="text-5xl block mb-4 animate-pulse">🗺️</span>
      <p className="text-sm text-[var(--color-text-muted)]">Génération du plateau…</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-2">
        Chargement des questions pour chaque rue thématique
      </p>
    </div>
  )
}

// ── Playing Phase ──

function PlayingPhase({
  tournament,
  isUser1,
  partnerName,
  confirmQuit,
  setConfirmQuit,
}: {
  tournament: ReturnType<typeof useTournament>
  isUser1: boolean
  partnerName: string
  confirmQuit: boolean
  setConfirmQuit: (v: boolean) => void
}) {
  const { session } = tournament
  if (!session) return null

  const { board, game_state: gs } = session

  // Safety: if board is missing/incomplete (realtime truncation), show loading
  if (!board?.nodes || !board?.questions) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block animate-pulse">🗺️</span>
        <p className="text-sm text-[var(--color-text-muted)]">Chargement du plateau…</p>
        <button
          onClick={() => setConfirmQuit(true)}
          className="text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
        >
          Quitter le tournoi
        </button>
      </div>
    )
  }

  const isMyTurn = (isUser1 && gs.current_turn === 'p1') || (!isUser1 && gs.current_turn === 'p2')
  const myHp = isUser1 ? gs.hp_p1 : gs.hp_p2
  const theirHp = isUser1 ? gs.hp_p2 : gs.hp_p1
  const myPosition = isUser1 ? gs.position_p1 : gs.position_p2

  // Auto-recover from stale reveal/bonus phases (e.g. page refresh killed the setTimeout)
  useEffect(() => {
    if ((gs.phase === 'reveal' || gs.phase === 'bonus') && isMyTurn) {
      const staleTimer = setTimeout(() => {
        advanceTurn(tournament, gs, board, isUser1)
      }, 4000) // 4s grace period then auto-advance
      return () => clearTimeout(staleTimer)
    }
  }, [gs.phase, gs.turn_number, isMyTurn, tournament, gs, board, isUser1])

  // Quit confirmation
  if (confirmQuit) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">⚠️</span>
        <p className="text-[var(--color-text)] font-medium">Quitter le tournoi ?</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          La session sera terminée pour les deux joueurs.
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => tournament.cancel()}
            className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            Oui, quitter
          </button>
          <button
            onClick={() => setConfirmQuit(false)}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            Reprendre
          </button>
        </div>
      </div>
    )
  }

  // ── Center Fight Phase ──
  if (session.status === 'center_fight' && gs.fight) {
    return (
      <div>
        <TournamentFight
          fight={gs.fight}
          questions={board.fight_questions}
          hpP1={gs.hp_p1}
          hpP2={gs.hp_p2}
          maxHp={gs.max_hp}
          isUser1={isUser1}
          partnerName={partnerName}
          onAnswer={(answerIdx, timeMs) => handleFightAnswer(tournament, gs, board, isUser1, answerIdx, timeMs)}
        />
        <div className="px-4 pt-4 pb-2">
          <button
            onClick={() => setConfirmQuit(true)}
            className="w-full text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
          >
            Quitter le tournoi
          </button>
        </div>
      </div>
    )
  }

  // ── Center Wait Phase ──
  if (gs.phase === 'center_wait') {
    const iAmAtCenter = myPosition === board.center
    const myBonus = isUser1 ? gs.center_bonus_p1 : gs.center_bonus_p2

    // Player at center sees a waiting screen
    if (iAmAtCenter) {
      return (
        <div className="px-4 text-center py-8 space-y-4">
          <span className="text-5xl block">⚔️</span>
          <p className="text-[var(--color-text)] font-medium">Tu es au centre !</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            En attente de {partnerName}…
          </p>
          {myBonus < CENTER_BONUS_MAX && (
            <p className="text-xs text-[var(--color-text-muted)]">
              Questions bonus : +{myBonus}/{CENTER_BONUS_MAX} PV gagnés
            </p>
          )}
          <button
            onClick={() => setConfirmQuit(true)}
            className="text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
          >
            Quitter le tournoi
          </button>
        </div>
      )
    }
    // Player NOT at center falls through to the normal move/question phases below
  }

  // ── Question Phase ──
  if (gs.phase === 'question' && gs.active_question_index != null) {
    const question = board.questions[gs.active_question_index]
    if (question) {
      return (
        <div>
          {/* HP Header */}
          <div className="px-4 mb-3">
            <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
              <TournamentHP current={myHp} max={gs.max_hp} label="Toi" />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] text-[var(--color-text-muted)]">Tour {gs.turn_number}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  isMyTurn
                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                }`}>
                  {isMyTurn ? 'Ton tour' : `Tour de ${partnerName}`}
                </span>
              </div>
              <TournamentHP current={theirHp} max={gs.max_hp} label={partnerName} />
            </div>
          </div>

          <TournamentQuestion
            question={question}
            isMyTurn={isMyTurn}
            onAnswer={(answerIdx, timeMs) => handleBoardAnswer(tournament, gs, board, isUser1, answerIdx, timeMs)}
            questionStartedAt={gs.question_started_at}
          />
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={() => setConfirmQuit(true)}
              className="w-full text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
            >
              Quitter
            </button>
          </div>
        </div>
      )
    }
  }

  // ── Reveal Phase (victory/defeat splash) ──
  if (gs.phase === 'reveal' && gs.active_question_index != null) {
    const question = board.questions[gs.active_question_index]
    if (question) {
      const wasCorrect = gs.answer === question.correct_index
      return (
        <div>
          <TournamentAnswerReveal
            isCorrect={wasCorrect}
            correctAnswer={question.options[question.correct_index]}
            myHp={myHp}
            maxHp={gs.max_hp}
            filmTitle={question.source_film.title}
          />
          <div className="px-4 pt-2 pb-2">
            <button
              onClick={() => setConfirmQuit(true)}
              className="w-full text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
            >
              Quitter
            </button>
          </div>
        </div>
      )
    }
  }

  // ── Bonus Phase ──
  if (gs.phase === 'bonus') {
    const currentNode = board.nodes[myPosition]
    const tileLabel = currentNode?.type === 'bonus_hp' ? '+1 PV !' : currentNode?.type === 'malus_hp' ? '-1 PV…' : ''

    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-6xl block">
          {currentNode?.type === 'bonus_hp' ? '💚' : '💔'}
        </span>
        <p className="text-xl font-bold text-[var(--color-text)]">{tileLabel}</p>
        <TournamentHP current={myHp} max={gs.max_hp} label="Tes PV" />
        <button
          onClick={() => setConfirmQuit(true)}
          className="text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
        >
          Quitter
        </button>
      </div>
    )
  }

  // ── Move Phase → Board + move selection ──
  const selectableMoves = isMyTurn ? getNextMoves(board, myPosition) : []
  const iAmAtCenter = myPosition === board.center
  const partnerAtCenter = gs.phase === 'center_wait' && !iAmAtCenter

  return (
    <div>
      {/* Partner at center banner */}
      {partnerAtCenter && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-center">
          <p className="text-xs text-yellow-400 font-medium">
            ⚔️ {partnerName} t'attend au centre — rejoins-le !
          </p>
        </div>
      )}

      {/* HP Header */}
      <div className="px-4 mb-2">
        <div className="flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
          <TournamentHP current={myHp} max={gs.max_hp} label="Toi" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)]">Tour {gs.turn_number}</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              isMyTurn
                ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
            }`}>
              {isMyTurn ? 'Avance !' : `Tour de ${partnerName}`}
            </span>
          </div>
          <TournamentHP current={theirHp} max={gs.max_hp} label={partnerName} />
        </div>
      </div>

      {/* Board */}
      <TournamentBoardView
        board={board}
        gameState={gs}
        isUser1={isUser1}
        selectableMoves={selectableMoves}
        onSelectMove={(nodeId) => handleMove(tournament, gs, board, isUser1, nodeId)}
      />

      {/* Street info when at crossroad */}
      {isMyTurn && selectableMoves.length > 1 && (
        <div className="px-4 mt-2">
          <p className="text-center text-xs text-[var(--color-text-muted)] mb-2">
            Choisis ta rue :
          </p>
          <div className="flex gap-2 justify-center">
            {selectableMoves.map(nodeId => {
              const node = board.nodes[nodeId]
              const street = node?.street_id ? board.streets.find(s => s.id === node.street_id) : null
              return (
                <button
                  key={nodeId}
                  onClick={() => handleMove(tournament, gs, board, isUser1, nodeId)}
                  className="px-3 py-2 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 text-[var(--color-accent)] text-xs font-medium hover:bg-[var(--color-accent)]/20 transition-colors"
                >
                  {street?.theme.label ?? '❓'}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => setConfirmQuit(true)}
          className="w-full text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
        >
          Quitter le tournoi
        </button>
      </div>
    </div>
  )
}

// ── Game Logic Handlers ──

async function handleMove(
  tournament: ReturnType<typeof useTournament>,
  gs: TournamentGameState,
  board: TournamentBoard,
  isUser1: boolean,
  targetNodeId: string,
) {
  const newGs = { ...gs }
  const mySide = isUser1 ? 'p1' : 'p2'

  // Update position
  if (mySide === 'p1') {
    newGs.position_p1 = targetNodeId
    newGs.visited_p1 = [...gs.visited_p1, targetNodeId]
  } else {
    newGs.position_p2 = targetNodeId
    newGs.visited_p2 = [...gs.visited_p2, targetNodeId]
  }

  const targetNode = board.nodes[targetNodeId]
  if (!targetNode) return

  // Reveal the tile
  if (!targetNode.revealed) {
    board.nodes[targetNodeId] = { ...targetNode, revealed: true }
  }

  // Handle tile type
  switch (targetNode.type) {
    case 'question':
    case 'bonus_collection':
    case 'bonus_watchlist': {
      // Show question
      newGs.phase = 'question'
      newGs.active_question_index = targetNode.question_index
      newGs.question_started_at = new Date().toISOString()
      newGs.answer = null
      newGs.answer_time_ms = null
      await tournament.updateGameState(newGs)
      break
    }

    case 'bonus_hp': {
      // +1 HP
      if (mySide === 'p1') newGs.hp_p1 = Math.min(gs.hp_p1 + 1, gs.max_hp + 2) // can exceed starting max by 2
      else newGs.hp_p2 = Math.min(gs.hp_p2 + 1, gs.max_hp + 2)
      newGs.phase = 'bonus'
      await tournament.updateGameState(newGs)
      // Auto-advance after delay
      setTimeout(() => advanceTurn(tournament, newGs, board, isUser1), 1500)
      break
    }

    case 'malus_hp': {
      // -1 HP
      if (mySide === 'p1') newGs.hp_p1 = gs.hp_p1 - 1
      else newGs.hp_p2 = gs.hp_p2 - 1
      newGs.phase = 'bonus'
      await tournament.updateGameState(newGs)

      // Check death
      const currentHp = mySide === 'p1' ? newGs.hp_p1 : newGs.hp_p2
      if (currentHp <= 0) {
        setTimeout(() => {
          newGs.winner = mySide === 'p1' ? 'p2' : 'p1'
          newGs.win_reason = 'hp_zero'
          newGs.phase = 'results'
          tournament.updateGameStateAndStatus(newGs, 'done')
        }, 1500)
      } else {
        setTimeout(() => advanceTurn(tournament, newGs, board, isUser1), 1500)
      }
      break
    }

    case 'center_fight': {
      // Arrived at center
      const otherPosition = mySide === 'p1' ? gs.position_p2 : gs.position_p1
      if (otherPosition === board.center) {
        // Both at center → start fight
        startFight(tournament, newGs, board)
      } else {
        // Wait for other player
        newGs.phase = 'center_wait'
        // Switch turn so the other player keeps moving
        newGs.current_turn = mySide === 'p1' ? 'p2' : 'p1'
        await tournament.updateGameState(newGs)
      }
      break
    }

    case 'crossroad': {
      // Crossroad: stay on same player's turn to pick a branch
      // Keep center_wait phase if applicable
      const someoneAtCenter = newGs.position_p1 === board.center || newGs.position_p2 === board.center
      newGs.phase = someoneAtCenter ? 'center_wait' : 'move'
      newGs.turn_number++
      await tournament.updateGameState(newGs)
      break
    }

    default: {
      advanceTurn(tournament, newGs, board, isUser1)
    }
  }
}

async function handleBoardAnswer(
  tournament: ReturnType<typeof useTournament>,
  gs: TournamentGameState,
  board: TournamentBoard,
  isUser1: boolean,
  answerIndex: number,
  _timeMs: number,
) {
  const mySide = isUser1 ? 'p1' : 'p2'
  const question = gs.active_question_index != null ? board.questions[gs.active_question_index] : null
  if (!question) return

  const isCorrect = answerIndex === question.correct_index
  const newGs: TournamentGameState = { ...gs, answer: answerIndex, answer_time_ms: _timeMs, phase: 'reveal' }

  if (!isCorrect) {
    if (mySide === 'p1') newGs.hp_p1 = gs.hp_p1 - 1
    else newGs.hp_p2 = gs.hp_p2 - 1
  }

  await tournament.updateGameState(newGs)

  // Check death
  const currentHp = mySide === 'p1' ? newGs.hp_p1 : newGs.hp_p2
  if (currentHp <= 0) {
    setTimeout(() => {
      const endGs: TournamentGameState = {
        ...newGs,
        winner: mySide === 'p1' ? 'p2' : 'p1',
        win_reason: 'hp_zero',
        phase: 'results',
      }
      tournament.updateGameStateAndStatus(endGs, 'done')
    }, REVEAL_DELAY)
    return
  }

  // Advance after delay
  setTimeout(() => advanceTurn(tournament, newGs, board, isUser1), REVEAL_DELAY)
}

function advanceTurn(
  tournament: ReturnType<typeof useTournament>,
  gs: TournamentGameState,
  board: TournamentBoard,
  _isUser1: boolean,
) {
  const newGs = { ...gs }
  newGs.turn_number++
  newGs.active_question_index = null
  newGs.question_started_at = null
  newGs.answer = null
  newGs.answer_time_ms = null

  // Check if either player is at center (center_wait scenario)
  const p1AtCenter = newGs.position_p1 === board.center
  const p2AtCenter = newGs.position_p2 === board.center

  if (p1AtCenter && p2AtCenter) {
    // Both at center → start fight
    startFight(tournament, newGs, board)
    return
  }

  if (p1AtCenter || p2AtCenter) {
    // One player at center — the OTHER keeps playing (no turn switch)
    newGs.phase = 'center_wait'
    // The player NOT at center continues
    newGs.current_turn = p1AtCenter ? 'p2' : 'p1'
  } else {
    // Normal: switch turns
    newGs.phase = 'move'
    newGs.current_turn = gs.current_turn === 'p1' ? 'p2' : 'p1'
  }

  tournament.updateGameState(newGs)
}

function startFight(
  tournament: ReturnType<typeof useTournament>,
  gs: TournamentGameState,
  _board: TournamentBoard,
) {
  const fight: FightState = {
    round: 1,
    max_rounds: 5,
    current_answerer: 'p1', // P1 starts the fight
    question_index: 0,
    answer: null,
    answer_time_ms: null,
  }
  const newGs = { ...gs, phase: 'center_fight' as const, fight }
  tournament.updateGameStateAndStatus(newGs, 'center_fight')
}

async function handleFightAnswer(
  tournament: ReturnType<typeof useTournament>,
  gs: TournamentGameState,
  board: TournamentBoard,
  _isUser1: boolean,
  answerIndex: number,
  timeMs: number,
) {
  if (!gs.fight) return
  const fight = { ...gs.fight }
  const question = fight.question_index != null ? board.fight_questions[fight.question_index] : null
  if (!question) return

  const isCorrect = answerIndex === question.correct_index
  const updatedFight: FightState = { ...fight, answer: answerIndex, answer_time_ms: timeMs }
  const newGs: TournamentGameState = { ...gs, fight: updatedFight }

  // Apply HP loss for wrong answer
  if (!isCorrect) {
    if (fight.current_answerer === 'p1') newGs.hp_p1 = gs.hp_p1 - 1
    else newGs.hp_p2 = gs.hp_p2 - 1
  }

  await tournament.updateGameState(newGs)

  // Check death
  if (newGs.hp_p1 <= 0 || newGs.hp_p2 <= 0) {
    setTimeout(() => {
      const endGs: TournamentGameState = {
        ...newGs,
        winner: newGs.hp_p1 <= 0 ? 'p2' : 'p1',
        win_reason: 'fight_won',
        phase: 'results',
      }
      tournament.updateGameStateAndStatus(endGs, 'done')
    }, REVEAL_DELAY)
    return
  }

  // Advance fight
  setTimeout(() => {
    const nextRound = fight.current_answerer === 'p2' ? fight.round + 1 : fight.round
    const nextQuestionIndex = Math.min(
      (fight.question_index ?? 0) + 1,
      board.fight_questions.length - 1
    )
    const nextAnswerer = fight.current_answerer === 'p1' ? 'p2' as const : 'p1' as const

    if (nextRound > fight.max_rounds) {
      // Max rounds reached → winner by HP
      if (newGs.hp_p1 !== newGs.hp_p2) {
        const endGs: TournamentGameState = {
          ...newGs,
          winner: newGs.hp_p1 > newGs.hp_p2 ? 'p1' : 'p2',
          win_reason: 'fight_won',
          phase: 'results',
        }
        tournament.updateGameStateAndStatus(endGs, 'done')
      } else {
        // Sudden death — continue
        const sdFight: FightState = {
          round: nextRound,
          max_rounds: fight.max_rounds + 2,
          current_answerer: nextAnswerer,
          question_index: nextQuestionIndex,
          answer: null,
          answer_time_ms: null,
        }
        tournament.updateGameState({ ...newGs, fight: sdFight })
      }
    } else {
      // Next question in fight
      const advFight: FightState = {
        round: nextRound,
        max_rounds: fight.max_rounds,
        current_answerer: nextAnswerer,
        question_index: nextQuestionIndex,
        answer: null,
        answer_time_ms: null,
      }
      tournament.updateGameState({ ...newGs, fight: advFight })
    }
  }, REVEAL_DELAY)
}
