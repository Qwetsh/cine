import { shuffle, pickRandom } from './quiz'
import type { QuizQuestion } from './quiz'
import { DECOY_DIRECTORS, DECOY_ACTORS, DECOY_COUNTRIES } from './quiz-decoys'
import { DECADES } from './discover'

// ── Types ──

export type TileType =
  | 'start_p1'
  | 'start_p2'
  | 'question'
  | 'crossroad'
  | 'bonus_hp'
  | 'malus_hp'
  | 'bonus_collection'
  | 'bonus_watchlist'
  | 'center_fight'

export type StreetThemeKind = 'actor' | 'director' | 'country' | 'decade' | 'poster' | 'general'

export interface StreetTheme {
  kind: StreetThemeKind
  label: string       // "Rue DiCaprio", "Rue France", "Rue 2000s"
  value: string | null // actor name, country code, decade label — null for general/poster
}

export interface BoardNode {
  id: string
  type: TileType
  edges: string[]          // next node IDs (1 for linear, 2-3 for crossroads)
  street_id: string | null // which street this belongs to
  question_index: number | null // index into TournamentBoard.questions
  revealed: boolean        // for bonus/malus: hidden until visited
}

export interface Street {
  id: string
  theme: StreetTheme
  node_ids: string[]       // ordered node IDs in this street
}

export interface TournamentBoard {
  nodes: Record<string, BoardNode>
  streets: Street[]
  questions: QuizQuestion[]
  fight_questions: QuizQuestion[]
  start_p1: string
  start_p2: string
  center: string
}

export type TournamentPhase =
  | 'move'
  | 'question'
  | 'reveal'
  | 'bonus'
  | 'center_wait'
  | 'center_fight'
  | 'fight_question'
  | 'fight_reveal'
  | 'results'

export interface FightState {
  round: number
  max_rounds: number
  current_answerer: 'p1' | 'p2'
  question_index: number | null
  answer: number | null
  answer_time_ms: number | null
}

export interface TournamentGameState {
  current_turn: 'p1' | 'p2'
  turn_number: number
  phase: TournamentPhase
  position_p1: string
  position_p2: string
  hp_p1: number
  hp_p2: number
  max_hp: number
  visited_p1: string[]
  visited_p2: string[]
  active_question_index: number | null
  question_started_at: string | null
  answer: number | null
  answer_time_ms: number | null
  // Center fight
  fight: FightState | null
  center_bonus_p1: number // bonus PV gained from center waiting
  center_bonus_p2: number
  // Result
  winner: 'p1' | 'p2' | null
  win_reason: 'hp_zero' | 'fight_won' | 'fight_sudden_death' | null
}

// ── Constants ──

const STARTING_HP = 5
const INTRO_TILES = 2       // general question tiles before first crossroad
const TILES_PER_STREET = 4  // question tiles per themed street (including specials)
const BRANCH_COUNT = 2      // branches per crossroad
const FIGHT_QUESTIONS = 10  // pre-generated fight questions (5 rounds + sudden death buffer)
const CENTER_BONUS_MAX = 2  // max PV bonus from waiting at center

export { STARTING_HP, CENTER_BONUS_MAX }

// ── Board Generation ──

/** Pick unique street themes for the board */
function pickStreetThemes(count: number): StreetTheme[] {
  const themes: StreetTheme[] = []

  // Build a pool of possible themed streets
  const pool: StreetTheme[] = []

  // Actor streets (pick 4 famous actors)
  const actors = pickRandom(DECOY_ACTORS, 4)
  for (const name of actors) {
    pool.push({ kind: 'actor', label: `Rue ${name.split(' ').pop()}`, value: name })
  }

  // Director streets (pick 4)
  const directors = pickRandom(DECOY_DIRECTORS, 4)
  for (const name of directors) {
    pool.push({ kind: 'director', label: `Rue ${name.split(' ').pop()}`, value: name })
  }

  // Country streets (pick 3)
  const countries = pickRandom([...DECOY_COUNTRIES], 3)
  for (const c of countries) {
    pool.push({ kind: 'country', label: `Rue ${c.name}`, value: c.code })
  }

  // Decade streets (pick 3)
  const decades = pickRandom([...DECADES], 3)
  for (const d of decades) {
    pool.push({ kind: 'decade', label: `Rue ${d.label}`, value: d.label })
  }

  // Poster street
  pool.push({ kind: 'poster', label: 'Rue Affiches', value: null })

  // General street
  pool.push({ kind: 'general', label: 'Rue Classique', value: null })

  const shuffled = shuffle(pool)
  for (let i = 0; i < count && i < shuffled.length; i++) {
    themes.push(shuffled[i])
  }

  return themes
}

/** Create a node */
function createNode(
  id: string,
  type: TileType,
  streetId: string | null = null,
  questionIndex: number | null = null,
): BoardNode {
  return {
    id,
    type,
    edges: [],
    street_id: streetId,
    question_index: questionIndex,
    revealed: type !== 'bonus_hp' && type !== 'malus_hp'
      && type !== 'bonus_collection' && type !== 'bonus_watchlist',
  }
}

/** Generate one side of the board (from start to center) */
function generateSide(
  side: 'p1' | 'p2',
  streets: Street[],
  streetThemes: StreetTheme[],
  nodes: Record<string, BoardNode>,
  questionCounter: { value: number },
): { startId: string; convergenceId: string } {
  const prefix = side

  // Start node
  const startId = `${prefix}_start`
  nodes[startId] = createNode(startId, side === 'p1' ? 'start_p1' : 'start_p2')

  // Intro tiles (general questions)
  let prevId = startId
  for (let i = 0; i < INTRO_TILES; i++) {
    const tileId = `${prefix}_intro_${i}`
    const qi = questionCounter.value++
    nodes[tileId] = createNode(tileId, 'question', null, qi)
    nodes[prevId].edges.push(tileId)
    prevId = tileId
  }

  // Crossroad
  const crossroadId = `${prefix}_cross`
  nodes[crossroadId] = createNode(crossroadId, 'crossroad')
  nodes[prevId].edges.push(crossroadId)

  // Branches
  const branchEndIds: string[] = []
  const sideThemes = streetThemes.splice(0, BRANCH_COUNT)

  for (let b = 0; b < sideThemes.length; b++) {
    const theme = sideThemes[b]
    const streetId = `${prefix}_street_${b}`
    const street: Street = { id: streetId, theme, node_ids: [] }

    // Decide where to place the special tile (bonus/malus)
    const specialPos = 1 + Math.floor(Math.random() * (TILES_PER_STREET - 1))
    const isBonus = Math.random() < 0.6

    let branchPrev = crossroadId
    for (let t = 0; t < TILES_PER_STREET; t++) {
      const tileId = `${prefix}_s${b}_t${t}`
      let type: TileType = 'question'
      let qi: number | null = questionCounter.value++

      if (t === specialPos) {
        // 30% chance of collection/watchlist tile instead of simple bonus/malus
        const specialRoll = Math.random()
        if (specialRoll < 0.15) {
          type = 'bonus_collection'
          // collection tile still has a question
        } else if (specialRoll < 0.3) {
          type = 'bonus_watchlist'
        } else {
          type = isBonus ? 'bonus_hp' : 'malus_hp'
          qi = null // pure bonus/malus — no question
        }
      }

      nodes[tileId] = createNode(tileId, type, streetId, qi)
      nodes[branchPrev].edges.push(tileId)
      street.node_ids.push(tileId)
      branchPrev = tileId
    }

    branchEndIds.push(branchPrev)
    streets.push(street)
  }

  // Convergence node (merges branches before center)
  const convergenceId = `${prefix}_merge`
  nodes[convergenceId] = createNode(convergenceId, 'question', null, questionCounter.value++)
  for (const endId of branchEndIds) {
    nodes[endId].edges.push(convergenceId)
  }

  return { startId, convergenceId }
}

/** Generate a complete tournament board (no questions yet — just structure) */
export function generateBoardStructure(): {
  board: Omit<TournamentBoard, 'questions' | 'fight_questions'>
  questionSlotCount: number
  streetThemes: StreetTheme[]
} {
  const nodes: Record<string, BoardNode> = {}
  const streets: Street[] = []
  const questionCounter = { value: 0 }

  // Pick themes for all streets (BRANCH_COUNT per side = 4 total)
  const allThemes = pickStreetThemes(BRANCH_COUNT * 2)
  const themesCopy = [...allThemes]

  // Generate P1 side (top → center)
  const p1 = generateSide('p1', streets, themesCopy, nodes, questionCounter)

  // Generate P2 side (bottom → center)
  const p2 = generateSide('p2', streets, themesCopy, nodes, questionCounter)

  // Center fight node
  const centerId = 'center'
  nodes[centerId] = createNode(centerId, 'center_fight')
  nodes[p1.convergenceId].edges.push(centerId)
  nodes[p2.convergenceId].edges.push(centerId)

  return {
    board: {
      nodes,
      streets,
      start_p1: p1.startId,
      start_p2: p2.startId,
      center: centerId,
    },
    questionSlotCount: questionCounter.value,
    streetThemes: allThemes,
  }
}

/** Fill question slots into the board structure */
export function fillBoardQuestions(
  boardStructure: Omit<TournamentBoard, 'questions' | 'fight_questions'>,
  questions: QuizQuestion[],
  fightQuestions: QuizQuestion[],
): TournamentBoard {
  return {
    ...boardStructure,
    questions,
    fight_questions: fightQuestions.slice(0, FIGHT_QUESTIONS),
  }
}

// ── Game State ──

export function createInitialGameState(board: TournamentBoard): TournamentGameState {
  return {
    current_turn: 'p1',
    turn_number: 0,
    phase: 'move',
    position_p1: board.start_p1,
    position_p2: board.start_p2,
    hp_p1: STARTING_HP,
    hp_p2: STARTING_HP,
    max_hp: STARTING_HP,
    visited_p1: [board.start_p1],
    visited_p2: [board.start_p2],
    active_question_index: null,
    question_started_at: null,
    answer: null,
    answer_time_ms: null,
    fight: null,
    center_bonus_p1: 0,
    center_bonus_p2: 0,
    winner: null,
    win_reason: null,
  }
}

// ── Navigation Helpers ──

/** Get the next possible moves for the current player */
export function getNextMoves(board: TournamentBoard, nodeId: string): string[] {
  const node = board.nodes[nodeId]
  if (!node) return []
  return node.edges
}

/** Get the street theme for a node */
export function getNodeStreet(board: TournamentBoard, nodeId: string): Street | null {
  const node = board.nodes[nodeId]
  if (!node?.street_id) return null
  return board.streets.find(s => s.id === node.street_id) ?? null
}

/** Check if a node is on a player's path (between their start and center) */
export function isNodeOnSide(nodeId: string, side: 'p1' | 'p2'): boolean {
  return nodeId.startsWith(side) || nodeId === 'center'
}

/** Get all nodes in order from start to center for a given side */
export function getPathNodes(board: TournamentBoard, side: 'p1' | 'p2'): string[] {
  const allNodes: string[] = []
  const visited = new Set<string>()

  function walk(nodeId: string) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)
    allNodes.push(nodeId)
    const node = board.nodes[nodeId]
    if (!node || node.type === 'center_fight') return
    for (const edgeId of node.edges) {
      walk(edgeId)
    }
  }

  const startId = side === 'p1' ? board.start_p1 : board.start_p2
  walk(startId)
  allNodes.push(board.center)
  return allNodes
}

/** Count how many tiles remain between current position and center */
export function tilesUntilCenter(
  board: TournamentBoard,
  fromNodeId: string,
  _side: 'p1' | 'p2',
): number {
  // BFS shortest path to center
  const queue: [string, number][] = [[fromNodeId, 0]]
  const visited = new Set<string>([fromNodeId])

  while (queue.length > 0) {
    const [current, dist] = queue.shift()!
    if (current === board.center) return dist

    const node = board.nodes[current]
    if (!node) continue
    for (const next of node.edges) {
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([next, dist + 1])
      }
    }
  }

  return -1 // unreachable (shouldn't happen with valid board)
}
