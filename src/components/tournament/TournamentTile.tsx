import type { BoardNode, TournamentBoard, Street } from '../../lib/tournament-board'

interface Props {
  node: BoardNode
  board: TournamentBoard
  isCurrentP1: boolean
  isCurrentP2: boolean
  visitedByP1: boolean
  visitedByP2: boolean
  isSelectable: boolean
  onSelect?: () => void
}

function getTileIcon(node: BoardNode, street: Street | null): string {
  if (!node.revealed) return '❓'

  switch (node.type) {
    case 'start_p1': return '🏁'
    case 'start_p2': return '🏁'
    case 'crossroad': return '⇅'
    case 'bonus_hp': return '💚'
    case 'malus_hp': return '💔'
    case 'bonus_collection': return '🎬'
    case 'bonus_watchlist': return '📋'
    case 'center_fight': return '⚔️'
    case 'question': {
      if (!street) return '❓'
      switch (street.theme.kind) {
        case 'actor': return '🎭'
        case 'director': return '🎬'
        case 'country': return '🌍'
        case 'decade': return '📅'
        case 'poster': return '🖼️'
        case 'general': return '🎲'
      }
    }
  }
}

export function TournamentTile({
  node,
  board,
  isCurrentP1,
  isCurrentP2,
  visitedByP1,
  visitedByP2,
  isSelectable,
  onSelect,
}: Props) {
  const street = node.street_id
    ? board.streets.find(s => s.id === node.street_id) ?? null
    : null
  const icon = getTileIcon(node, street)

  const isCenter = node.type === 'center_fight'
  const isStart = node.type === 'start_p1' || node.type === 'start_p2'
  const isVisited = visitedByP1 || visitedByP2
  const hasBothPlayers = isCurrentP1 && isCurrentP2

  let bgClass = 'bg-[var(--color-surface)] border-[var(--color-border)]'
  let ringClass = ''

  if (isCenter) {
    bgClass = 'bg-yellow-500/20 border-yellow-500/50'
  } else if (isStart) {
    bgClass = 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/30'
  } else if (isSelectable) {
    bgClass = 'bg-[var(--color-accent)]/20 border-[var(--color-accent)] cursor-pointer'
  } else if (isVisited) {
    bgClass = 'bg-[var(--color-surface-2)] border-[var(--color-border)] opacity-60'
  }

  if (isCurrentP1 && !isCurrentP2) {
    ringClass = 'ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-bg)]'
  } else if (isCurrentP2 && !isCurrentP1) {
    ringClass = 'ring-2 ring-red-400 ring-offset-1 ring-offset-[var(--color-bg)]'
  } else if (hasBothPlayers) {
    ringClass = 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-[var(--color-bg)]'
  }

  return (
    <button
      onClick={isSelectable ? onSelect : undefined}
      disabled={!isSelectable}
      className={`
        relative w-11 h-11 rounded-full border flex items-center justify-center
        transition-all duration-300 text-base flex-shrink-0
        ${bgClass} ${ringClass}
        ${isSelectable ? 'animate-pulse hover:scale-110' : ''}
        ${isCenter ? 'w-14 h-14 text-xl' : ''}
      `}
    >
      {icon}
      {/* Player indicators */}
      {isCurrentP1 && (
        <div className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-[var(--color-accent)] border-2 border-[var(--color-bg)] text-[6px] text-white flex items-center justify-center font-bold">
          1
        </div>
      )}
      {isCurrentP2 && (
        <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-400 border-2 border-[var(--color-bg)] text-[6px] text-white flex items-center justify-center font-bold">
          2
        </div>
      )}
      {/* Checkmark for visited */}
      {isVisited && !isCurrentP1 && !isCurrentP2 && (
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 text-white text-[7px] flex items-center justify-center">
          ✓
        </div>
      )}
    </button>
  )
}
