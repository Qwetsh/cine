import { tmdb } from './tmdb'
import { generateQuestions, generatePosterQuestions, shuffle } from './quiz'
import type { QuizQuestion } from './quiz'
import { discoverMoviesByTheme } from './discover'
import type { QuizDifficulty } from './discover'
import type { StreetTheme } from './tournament-board'

/** Generate questions for a themed street */
async function generateStreetQuestions(
  theme: StreetTheme,
  count: number,
  difficulty: QuizDifficulty = 'normal',
): Promise<QuizQuestion[]> {
  const movies = await discoverMoviesByTheme(theme.kind, theme.value, difficulty)
  if (movies.length === 0) return []

  if (theme.kind === 'poster') {
    return generatePosterQuestions(movies, count)
  }

  // Pick random movies from pool, fetch details, generate questions
  const shuffled = shuffle(movies)
  const picked = shuffled.slice(0, Math.min(count * 2, 12))
  const details = await Promise.all(
    picked.map(m => tmdb.getMovie(m.id))
  )

  const pool = details.flatMap(m => generateQuestions(m))
  return shuffle(pool).slice(0, count)
}

/** Generate general/mixed questions (for intro tiles, fight, etc.) */
async function generateGeneralQuestions(count: number, difficulty: QuizDifficulty = 'normal'): Promise<QuizQuestion[]> {
  const movies = await discoverMoviesByTheme('general', null, difficulty)
  if (movies.length === 0) return []

  const shuffled = shuffle(movies)
  const picked = shuffled.slice(0, Math.min(count * 2, 15))
  const details = await Promise.all(
    picked.map(m => tmdb.getMovie(m.id))
  )

  const pool = details.flatMap(m => generateQuestions(m))

  // Maximize film diversity: 1 question per film
  const usedFilms = new Set<number>()
  const diverse: QuizQuestion[] = []
  const rest: QuizQuestion[] = []
  for (const q of shuffle(pool)) {
    if (!usedFilms.has(q.source_film.tmdb_id)) {
      usedFilms.add(q.source_film.tmdb_id)
      diverse.push(q)
    } else {
      rest.push(q)
    }
  }

  return [...diverse, ...rest].slice(0, count)
}

export interface TournamentQuestionsResult {
  /** Questions indexed by slot position (matches BoardNode.question_index) */
  questions: QuizQuestion[]
  /** Extra questions for the center fight */
  fightQuestions: QuizQuestion[]
}

/**
 * Generate all questions for a tournament board.
 * Maps each question slot to a question from the appropriate theme.
 */
export async function generateTournamentQuestions(
  streetThemes: StreetTheme[],
  questionSlotCount: number,
  tilesPerStreet: number = 4,
  difficulty: QuizDifficulty = 'normal',
): Promise<TournamentQuestionsResult> {
  // Generate questions per street theme in parallel
  const streetQuestionsPromises = streetThemes.map(theme =>
    generateStreetQuestions(theme, tilesPerStreet + 2, difficulty) // extra buffer
  )

  // General questions for intro tiles
  const introCount = 4 + 2 // 2 intro tiles per side + 1 merge tile per side
  const generalPromise = generateGeneralQuestions(introCount + 10, difficulty) // +10 for fight

  const [streetResults, generalQuestions] = await Promise.all([
    Promise.all(streetQuestionsPromises),
    generalPromise,
  ])

  // Build the questions array indexed by slot position.
  // Slot order follows the board generation order:
  // P1 intro (0,1) → P1 street0 tiles → P1 street1 tiles → P1 merge →
  // P2 intro → P2 street0 tiles → P2 street1 tiles → P2 merge
  const questions: QuizQuestion[] = new Array(questionSlotCount)
  let generalIdx = 0
  let slotIdx = 0

  // Helper: fill a slot
  function fillSlot(q: QuizQuestion | undefined) {
    if (slotIdx >= questionSlotCount) return
    if (q) {
      questions[slotIdx] = q
    } else {
      // Fallback to general
      questions[slotIdx] = generalQuestions[generalIdx++ % generalQuestions.length]
    }
    slotIdx++
  }

  // For each side (p1 then p2), the slot order is:
  // 2 intro tiles → BRANCH_COUNT streets × tilesPerStreet tiles → 1 merge tile
  for (let side = 0; side < 2; side++) {
    // Intro tiles (general)
    for (let i = 0; i < 2; i++) {
      fillSlot(generalQuestions[generalIdx++])
    }

    // Street tiles (2 streets per side)
    for (let b = 0; b < 2; b++) {
      const streetIdx = side * 2 + b
      const streetQs = streetResults[streetIdx] ?? []
      let qi = 0
      for (let t = 0; t < tilesPerStreet; t++) {
        fillSlot(streetQs[qi++])
      }
    }

    // Merge tile (general)
    fillSlot(generalQuestions[generalIdx++ % generalQuestions.length])
  }

  // Fill any remaining unfilled slots with general questions
  for (let i = 0; i < questionSlotCount; i++) {
    if (!questions[i]) {
      questions[i] = generalQuestions[generalIdx++ % generalQuestions.length]
    }
  }

  // Fight questions from remaining general pool
  const fightQuestions = generalQuestions.slice(generalIdx).concat(
    // If not enough, generate more from the street leftovers
    streetResults.flatMap(sq => sq.slice(tilesPerStreet))
  ).slice(0, 10)

  return { questions, fightQuestions }
}
