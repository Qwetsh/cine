import { useEffect, useRef } from 'react'
import type { TournamentBoard as TBoard, TournamentGameState } from '../../lib/tournament-board'
import { TournamentTile } from './TournamentTile'

interface Props {
  board: TBoard
  gameState: TournamentGameState
  isUser1: boolean
  selectableMoves: string[]
  onSelectMove: (nodeId: string) => void
}

/**
 * Vertical scrollable board visualization.
 * P1 starts at top, P2 at bottom, center in the middle.
 * Renders the board as rows of tiles connected by lines.
 */
export function TournamentBoardView({
  board,
  gameState,
  isUser1,
  selectableMoves,
  onSelectMove,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active player's position
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [gameState.position_p1, gameState.position_p2, gameState.current_turn])

  // Build rows for the board layout
  const rows = buildBoardRows(board)
  const myPosition = isUser1 ? gameState.position_p1 : gameState.position_p2

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto max-h-[280px] px-4 py-3 scrollbar-hide"
    >
      <div className="flex flex-col items-center gap-1">
        {rows.map((row, rowIdx) => {
          const isActiveRow = row.nodeIds.includes(myPosition)

          return (
            <div key={rowIdx} ref={isActiveRow ? activeRef : undefined}>
              {/* Street label */}
              {row.streetLabel && (
                <div className="text-center mb-1">
                  <span className="text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-full">
                    {row.streetLabel}
                  </span>
                </div>
              )}

              {/* Connector line above */}
              {rowIdx > 0 && row.type !== 'branch_start' && (
                <div className="flex justify-center">
                  <div className="w-px h-3 bg-[var(--color-border)]" />
                </div>
              )}

              {/* Branch fork indicator */}
              {row.type === 'branch_start' && (
                <div className="flex justify-center my-1">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-px bg-[var(--color-border)]" />
                    <span className="text-[10px] text-[var(--color-text-muted)]">↙ ↘</span>
                    <div className="w-8 h-px bg-[var(--color-border)]" />
                  </div>
                </div>
              )}

              {/* Branch merge indicator */}
              {row.type === 'branch_end' && (
                <div className="flex justify-center my-1">
                  <div className="flex items-center gap-6">
                    <div className="w-8 h-px bg-[var(--color-border)]" />
                    <span className="text-[10px] text-[var(--color-text-muted)]">↗ ↘</span>
                    <div className="w-8 h-px bg-[var(--color-border)]" />
                  </div>
                </div>
              )}

              {/* Tile(s) */}
              <div className={`flex justify-center ${
                row.nodeIds.length > 1 ? 'gap-8' : ''
              }`}>
                {row.nodeIds.map(nodeId => {
                  const node = board.nodes[nodeId]
                  if (!node) return null
                  return (
                    <TournamentTile
                      key={nodeId}
                      node={node}
                      board={board}
                      isCurrentP1={gameState.position_p1 === nodeId}
                      isCurrentP2={gameState.position_p2 === nodeId}
                      visitedByP1={gameState.visited_p1.includes(nodeId)}
                      visitedByP2={gameState.visited_p2.includes(nodeId)}
                      isSelectable={selectableMoves.includes(nodeId)}
                      onSelect={() => onSelectMove(nodeId)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Board Layout Builder ──

interface BoardRow {
  nodeIds: string[]
  type: 'single' | 'branch_start' | 'branch_tiles' | 'branch_end' | 'center'
  streetLabel?: string
}

/**
 * Convert the board graph into a flat list of rows for rendering.
 * P1's side on top, center in middle, P2's side on bottom.
 */
function buildBoardRows(board: TBoard): BoardRow[] {
  const rows: BoardRow[] = []

  // Build P1 side
  buildSideRows(board, 'p1', rows)

  // Center
  rows.push({ nodeIds: [board.center], type: 'center' })

  // Build P2 side (reversed — from merge back to start)
  const p2Rows: BoardRow[] = []
  buildSideRows(board, 'p2', p2Rows)
  rows.push(...p2Rows.reverse())

  return rows
}

function buildSideRows(board: TBoard, side: 'p1' | 'p2', rows: BoardRow[]) {
  const startId = side === 'p1' ? board.start_p1 : board.start_p2
  const startNode = board.nodes[startId]
  if (!startNode) return

  // Start
  rows.push({ nodeIds: [startId], type: 'single' })

  // Walk intro tiles
  let current = startId
  while (true) {
    const node = board.nodes[current]
    if (!node) break
    const nextIds = node.edges
    if (nextIds.length === 0) break

    // Single path (intro tiles)
    if (nextIds.length === 1) {
      const next = board.nodes[nextIds[0]]
      if (!next) break

      if (next.type === 'crossroad') {
        // Found crossroad — handle branching
        rows.push({ nodeIds: [nextIds[0]], type: 'single' })
        buildBranches(board, nextIds[0], rows)
        return
      }

      rows.push({ nodeIds: [nextIds[0]], type: 'single' })
      current = nextIds[0]
    } else {
      // Multiple edges = this is already a crossroad
      buildBranches(board, current, rows)
      return
    }
  }
}

function buildBranches(board: TBoard, crossroadId: string, rows: BoardRow[]) {
  const crossNode = board.nodes[crossroadId]
  if (!crossNode) return

  const branchIds = crossNode.edges
  if (branchIds.length < 2) return

  // Collect street labels for the branches
  const streetLabels: string[] = []
  for (const startId of branchIds) {
    const node = board.nodes[startId]
    if (node?.street_id) {
      const street = board.streets.find(s => s.id === node.street_id)
      streetLabels.push(street?.theme.label ?? '')
    } else {
      streetLabels.push('')
    }
  }

  // Branch start indicator with labels
  rows.push({
    nodeIds: branchIds,
    type: 'branch_start',
    streetLabel: streetLabels.filter(Boolean).join('  •  '),
  })

  // Walk each branch in parallel, building rows of paired tiles
  const branchPaths: string[][] = branchIds.map(startId => {
    const path: string[] = [startId]
    let cur = startId
    while (true) {
      const node = board.nodes[cur]
      if (!node || node.edges.length === 0) break
      const nextId = node.edges[0]
      const next = board.nodes[nextId]
      if (!next || !next.street_id) break // hit merge node
      path.push(nextId)
      cur = nextId
    }
    return path
  })

  // Render branch tiles side by side
  const maxLen = Math.max(...branchPaths.map(p => p.length))
  for (let i = 0; i < maxLen; i++) {
    const nodeIds = branchPaths.map(p => p[i]).filter(Boolean)
    rows.push({ nodeIds, type: 'branch_tiles' })
  }

  // Find merge node (first non-street edge from any branch end)
  const lastBranchNode = board.nodes[branchPaths[0][branchPaths[0].length - 1]]
  if (lastBranchNode) {
    const mergeId = lastBranchNode.edges.find(id => {
      const n = board.nodes[id]
      return n && !n.street_id
    })
    if (mergeId) {
      rows.push({ nodeIds: [mergeId], type: 'branch_end' })
    }
  }
}
