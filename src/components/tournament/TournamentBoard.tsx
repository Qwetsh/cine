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
 * Vertical scrollable board visualization — festival cinema theme.
 * P1 starts at top, P2 at bottom, center in the middle.
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

  const rows = buildBoardRows(board)
  const myPosition = isUser1 ? gameState.position_p1 : gameState.position_p2

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto max-h-[320px] px-4 py-4 scrollbar-hide relative"
      style={{
        background: 'linear-gradient(180deg, rgba(60,10,20,0.3) 0%, rgba(20,8,15,0.5) 50%, rgba(15,25,60,0.3) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(234,179,8,0.15)',
      }}
    >
      {/* Subtle vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10,5,8,0.6) 100%)',
        }}
      />

      <div className="flex flex-col items-center gap-1 relative z-10">
        {rows.map((row, rowIdx) => {
          const isActiveRow = row.nodeIds.includes(myPosition)

          return (
            <div key={rowIdx} ref={isActiveRow ? activeRef : undefined}>
              {/* Fork: street labels + "ou" bubble */}
              {row.type === 'branch_start' && row.streetLabel && (
                <div className="flex items-center justify-center gap-2 my-2">
                  {row.streetLabel.split('  •  ').map((label, i, arr) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full italic"
                        style={{
                          color: 'rgba(234,179,8,0.9)',
                          background: 'rgba(234,179,8,0.08)',
                          border: '1px solid rgba(234,179,8,0.2)',
                        }}
                      >
                        {label}
                      </span>
                      {i < arr.length - 1 && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            color: 'rgba(234,179,8,0.7)',
                            background: 'rgba(234,179,8,0.05)',
                            border: '1px solid rgba(234,179,8,0.15)',
                          }}
                        >
                          ou
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Golden connector line */}
              {rowIdx > 0 && row.type !== 'branch_start' && (
                <div className="flex justify-center">
                  <div
                    className="w-px h-4"
                    style={{ background: 'linear-gradient(180deg, rgba(234,179,8,0.1), rgba(234,179,8,0.3), rgba(234,179,8,0.1))' }}
                  />
                </div>
              )}

              {/* Branch fork lines */}
              {row.type === 'branch_start' && (
                <div className="flex justify-center my-0.5">
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-px" style={{ background: 'rgba(234,179,8,0.25)' }} />
                    <span className="text-[10px]" style={{ color: 'rgba(234,179,8,0.4)' }}>↙ ↘</span>
                    <div className="w-6 h-px" style={{ background: 'rgba(234,179,8,0.25)' }} />
                  </div>
                </div>
              )}

              {/* Branch merge lines */}
              {row.type === 'branch_end' && (
                <div className="flex justify-center my-0.5">
                  <div className="flex items-center gap-4">
                    <div className="w-6 h-px" style={{ background: 'rgba(234,179,8,0.25)' }} />
                    <span className="text-[10px]" style={{ color: 'rgba(234,179,8,0.4)' }}>↗ ↘</span>
                    <div className="w-6 h-px" style={{ background: 'rgba(234,179,8,0.25)' }} />
                  </div>
                </div>
              )}

              {/* Tile(s) */}
              <div className={`flex justify-center ${
                row.nodeIds.length > 1 ? 'gap-10' : ''
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

  // Walk the graph iteratively, handling multiple forks
  let current = startId
  const visited = new Set<string>([startId])

  while (true) {
    const node = board.nodes[current]
    if (!node) break
    const nextIds = node.edges.filter(id => !visited.has(id))
    if (nextIds.length === 0) break

    if (nextIds.length === 1) {
      const next = board.nodes[nextIds[0]]
      if (!next) break
      visited.add(nextIds[0])

      if (next.type === 'crossroad') {
        rows.push({ nodeIds: [nextIds[0]], type: 'single' })
        const mergeId = buildBranches(board, nextIds[0], rows)
        if (mergeId) {
          visited.add(mergeId)
          current = mergeId
          continue
        }
        return
      }

      if (next.type === 'center_fight') break // stop before center
      rows.push({ nodeIds: [nextIds[0]], type: 'single' })
      current = nextIds[0]
    } else {
      // Multiple edges = this is a crossroad node
      const mergeId = buildBranches(board, current, rows)
      if (mergeId) {
        visited.add(mergeId)
        current = mergeId
        continue
      }
      return
    }
  }
}

/** Build rows for a fork (crossroad + branches + merge). Returns mergeId or null. */
function buildBranches(board: TBoard, crossroadId: string, rows: BoardRow[]): string | null {
  const crossNode = board.nodes[crossroadId]
  if (!crossNode) return null

  const branchIds = crossNode.edges
  if (branchIds.length < 2) return null

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
      return mergeId
    }
  }

  return null
}
