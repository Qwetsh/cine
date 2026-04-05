import type { BoardNode, TournamentBoard, Street, StreetThemeKind } from '../../lib/tournament-board'

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

// Theme → color palette for tiles
const THEME_COLORS: Record<StreetThemeKind, { bg: string; border: string; glow: string }> = {
  actor:    { bg: 'rgba(234, 179, 8, 0.15)',  border: 'rgba(234, 179, 8, 0.4)',  glow: 'rgba(234, 179, 8, 0.3)' },
  director: { bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)', glow: 'rgba(168, 85, 247, 0.3)' },
  country:  { bg: 'rgba(34, 197, 94, 0.15)',  border: 'rgba(34, 197, 94, 0.4)',  glow: 'rgba(34, 197, 94, 0.3)' },
  decade:   { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.4)', glow: 'rgba(99, 102, 241, 0.3)' },
  genre:    { bg: 'rgba(251, 146, 60, 0.15)', border: 'rgba(251, 146, 60, 0.4)', glow: 'rgba(251, 146, 60, 0.3)' },
  poster:   { bg: 'rgba(234, 179, 8, 0.12)',  border: 'rgba(234, 179, 8, 0.3)',  glow: 'rgba(234, 179, 8, 0.2)' },
  general:  { bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', glow: 'rgba(148, 163, 184, 0.2)' },
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
        case 'genre': return '🎪'
        case 'poster': return '🖼️'
        case 'general': return '🎲'
      }
    }
  }
}

function getThemeKind(node: BoardNode, board: TournamentBoard): StreetThemeKind | null {
  if (!node.street_id) return null
  const street = board.streets.find(s => s.id === node.street_id)
  return street?.theme.kind ?? null
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
  const themeKind = getThemeKind(node, board)

  const isCenter = node.type === 'center_fight'
  const isStart = node.type === 'start_p1' || node.type === 'start_p2'
  const isSurprise = node.type === 'bonus_hp' || node.type === 'malus_hp'
    || node.type === 'bonus_collection' || node.type === 'bonus_watchlist'
  const isVisited = visitedByP1 || visitedByP2
  const hasBothPlayers = isCurrentP1 && isCurrentP2

  // Theme-based colors
  const colors = themeKind ? THEME_COLORS[themeKind] : null

  // Build inline styles for themed tiles
  const tileStyle: React.CSSProperties = {}

  if (isCenter) {
    tileStyle.background = 'radial-gradient(circle, rgba(234,179,8,0.25) 0%, rgba(234,179,8,0.08) 100%)'
    tileStyle.borderColor = 'rgba(234,179,8,0.6)'
    tileStyle.boxShadow = '0 0 20px rgba(234,179,8,0.3), inset 0 0 8px rgba(234,179,8,0.1)'
  } else if (isSurprise && !node.revealed) {
    tileStyle.background = 'rgba(250, 204, 21, 0.12)'
    tileStyle.borderColor = 'rgba(250, 204, 21, 0.35)'
  } else if (isSelectable && colors) {
    tileStyle.background = colors.bg
    tileStyle.borderColor = colors.border
    tileStyle.boxShadow = `0 0 12px ${colors.glow}`
  } else if (isSelectable) {
    tileStyle.background = 'rgba(99, 102, 241, 0.2)'
    tileStyle.borderColor = 'rgba(99, 102, 241, 0.5)'
    tileStyle.boxShadow = '0 0 12px rgba(99, 102, 241, 0.3)'
  } else if (colors) {
    tileStyle.background = colors.bg
    tileStyle.borderColor = colors.border
  } else if (isStart) {
    tileStyle.background = 'rgba(99, 102, 241, 0.1)'
    tileStyle.borderColor = 'rgba(99, 102, 241, 0.3)'
  } else {
    tileStyle.background = 'rgba(30, 20, 25, 0.6)'
    tileStyle.borderColor = 'rgba(234, 179, 8, 0.15)'
  }

  if (isVisited && !isCurrentP1 && !isCurrentP2) {
    tileStyle.opacity = 0.5
  }

  // Player ring
  let ringStyle = ''
  if (isCurrentP1 && !isCurrentP2) {
    ringStyle = 'ring-2 ring-blue-400 ring-offset-1 ring-offset-[#1a0a10]'
  } else if (isCurrentP2 && !isCurrentP1) {
    ringStyle = 'ring-2 ring-red-400 ring-offset-1 ring-offset-[#1a0a10]'
  } else if (hasBothPlayers) {
    ringStyle = 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-[#1a0a10]'
  }

  return (
    <button
      onClick={isSelectable ? onSelect : undefined}
      disabled={!isSelectable}
      style={tileStyle}
      className={`
        relative flex-shrink-0 rounded-full border flex items-center justify-center
        transition-all duration-300 text-base
        ${ringStyle}
        ${isSelectable ? 'animate-pulse hover:scale-110 cursor-pointer' : ''}
        ${isCenter ? 'w-14 h-14 text-xl' : 'w-11 h-11'}
        ${isSurprise && !node.revealed ? 'tournament-surprise-pulse' : ''}
      `}
    >
      {icon}
      {/* Player pion P1 (blue) */}
      {isCurrentP1 && (
        <div
          className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full border-2 border-[#1a0a10] text-[7px] text-white flex items-center justify-center font-bold"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #60a5fa)', boxShadow: '0 0 6px rgba(59,130,246,0.5)' }}
        >
          1
        </div>
      )}
      {/* Player pion P2 (red) */}
      {isCurrentP2 && (
        <div
          className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-[#1a0a10] text-[7px] text-white flex items-center justify-center font-bold"
          style={{ background: 'linear-gradient(135deg, #ef4444, #f87171)', boxShadow: '0 0 6px rgba(239,68,68,0.5)' }}
        >
          2
        </div>
      )}
      {/* Checkmark for visited */}
      {isVisited && !isCurrentP1 && !isCurrentP2 && (
        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500/80 text-white text-[7px] flex items-center justify-center">
          ✓
        </div>
      )}
    </button>
  )
}
