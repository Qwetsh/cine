import type { TmdbMovieDetail } from './tmdb'
import {
  DECOY_DIRECTORS, DECOY_ACTORS, DECOY_TAGLINES,
  DECOY_COUNTRIES, RUNTIME_RANGES,
} from './quiz-decoys'

// ── Types ──

export type QuestionType =
  | 'release_year'
  | 'genre'
  | 'director'
  | 'actor_role'
  | 'actor_not_in'
  | 'runtime'
  | 'country'
  | 'tagline'
  | 'poster'

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface QuizQuestion {
  id: string
  type: QuestionType
  difficulty: Difficulty
  text: string
  options: string[]
  correct_index: number
  source_film: { tmdb_id: number; title: string }
  /** Poster path for 'poster' type questions (TMDB poster_path) */
  poster_path?: string | null
}

export interface QuizData {
  questions: QuizQuestion[]
  current_index: number
  question_started_at: string
  answers_user1: (number | null)[]
  answers_user2: (number | null)[]
  times_user1: (number | null)[]
  times_user2: (number | null)[]
  scores: [number, number]
  phase: 'generating' | 'countdown' | 'question' | 'reveal' | 'results'
}

// ── Helpers (exported for reuse by tournament) ──

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickRandom<T>(arr: T[], count: number): T[] {
  return shuffle(arr).slice(0, count)
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Place correct answer at a random position among 4 options */
function buildOptions(correct: string, wrongs: string[]): { options: string[]; correct_index: number } {
  const distractors = wrongs.slice(0, 3)
  const all = [...distractors, correct]
  const shuffled = shuffle(all)
  return {
    options: shuffled,
    correct_index: shuffled.indexOf(correct),
  }
}

function getDirector(movie: TmdbMovieDetail): string | null {
  return movie.credits?.crew.find(c => c.job === 'Director')?.name ?? null
}

// ── Question generators ──

function yearQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  if (!movie.release_date) return null
  const year = new Date(movie.release_date).getFullYear()

  // Generate 3 plausible wrong years (±1 to ±6, no duplicates)
  const wrongs = new Set<number>()
  while (wrongs.size < 3) {
    const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 6) + 1)
    const y = year + offset
    if (y > 1920 && y <= new Date().getFullYear() && y !== year) wrongs.add(y)
  }

  const { options, correct_index } = buildOptions(String(year), [...wrongs].map(String))
  return {
    id: makeId(),
    type: 'release_year',
    difficulty: 'easy',
    text: `En quelle année est sorti "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

function genreQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  if (!movie.genres?.length) return null
  const correct = movie.genres[0].name

  const allGenres = [
    'Action', 'Aventure', 'Animation', 'Comédie', 'Crime', 'Documentaire',
    'Drame', 'Familial', 'Fantastique', 'Histoire', 'Horreur', 'Musique',
    'Mystère', 'Romance', 'Science-Fiction', 'Téléfilm', 'Thriller', 'Guerre', 'Western',
  ]
  const movieGenreNames = movie.genres.map(g => g.name)
  const wrongs = pickRandom(allGenres.filter(g => !movieGenreNames.includes(g)), 3)

  if (wrongs.length < 3) return null
  const { options, correct_index } = buildOptions(correct, wrongs)
  return {
    id: makeId(),
    type: 'genre',
    difficulty: 'easy',
    text: `Quel est un genre du film "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

function directorQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  const director = getDirector(movie)
  if (!director) return null

  const wrongs = pickRandom(DECOY_DIRECTORS.filter(d => d !== director), 3)
  if (wrongs.length < 3) return null

  const { options, correct_index } = buildOptions(director, wrongs)
  return {
    id: makeId(),
    type: 'director',
    difficulty: 'medium',
    text: `Qui a réalisé "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

function actorRoleQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  const cast = movie.credits?.cast
  if (!cast || cast.length < 4) return null

  // Pick a cast member with a named character (not just "Self")
  const candidates = cast.filter(c => c.character && c.character !== 'Self' && c.order < 10)
  if (candidates.length === 0) return null

  const chosen = candidates[Math.floor(Math.random() * candidates.length)]
  const wrongs = pickRandom(
    DECOY_ACTORS.filter(a => a !== chosen.name && !cast.some(c => c.name === a)),
    3
  )
  if (wrongs.length < 3) return null

  const { options, correct_index } = buildOptions(chosen.name, wrongs)
  return {
    id: makeId(),
    type: 'actor_role',
    difficulty: 'medium',
    text: `Qui joue le rôle de ${chosen.character} dans "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

function actorNotInQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  const cast = movie.credits?.cast
  if (!cast || cast.length < 3) return null

  // 3 real cast members + 1 decoy who's NOT in the film
  const realActors = pickRandom(cast.slice(0, 8), 3).map(c => c.name)
  const castNames = cast.map(c => c.name)
  const decoy = DECOY_ACTORS.find(a => !castNames.includes(a) && !realActors.includes(a))
  if (!decoy) return null

  const { options, correct_index } = buildOptions(decoy, realActors)
  return {
    id: makeId(),
    type: 'actor_not_in',
    difficulty: 'medium',
    text: `Lequel de ces acteurs n'a PAS joué dans "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

function runtimeQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  if (!movie.runtime) return null

  const correctRange = RUNTIME_RANGES.find(r => movie.runtime! >= r.min && movie.runtime! <= r.max)
  if (!correctRange) return null

  const options = RUNTIME_RANGES.map(r => r.label)
  const correct_index = RUNTIME_RANGES.indexOf(correctRange)

  return {
    id: makeId(),
    type: 'runtime',
    difficulty: 'medium',
    text: `Quelle est la durée de "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

function countryQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  if (!movie.production_countries?.length) return null

  const correctCode = movie.production_countries[0].iso_3166_1
  const correctEntry = DECOY_COUNTRIES.find(c => c.code === correctCode)
  if (!correctEntry) return null

  const wrongs = pickRandom(
    DECOY_COUNTRIES.filter(c => c.code !== correctCode),
    3
  ).map(c => c.name)

  if (wrongs.length < 3) return null
  const { options, correct_index } = buildOptions(correctEntry.name, wrongs)
  return {
    id: makeId(),
    type: 'country',
    difficulty: 'hard',
    text: `De quel pays est originaire "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

function taglineQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  if (!movie.tagline || movie.tagline.length < 5) return null

  const wrongs = pickRandom(
    DECOY_TAGLINES.filter(t => t !== movie.tagline),
    3
  )
  if (wrongs.length < 3) return null

  const { options, correct_index } = buildOptions(movie.tagline, wrongs)
  return {
    id: makeId(),
    type: 'tagline',
    difficulty: 'hard',
    text: `Quel est le slogan/tagline de "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

// ── Public API ──

const GENERATORS: ((movie: TmdbMovieDetail) => QuizQuestion | null)[] = [
  yearQuestion,
  genreQuestion,
  directorQuestion,
  actorRoleQuestion,
  actorNotInQuestion,
  runtimeQuestion,
  countryQuestion,
  taglineQuestion,
]

/** Generate all possible questions from a single movie */
export function generateQuestions(movie: TmdbMovieDetail): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  for (const gen of GENERATORS) {
    const q = gen(movie)
    if (q) questions.push(q)
  }
  return questions
}

/** Select a balanced set of questions from a pool, maximizing film diversity */
export function selectQuestions(pool: QuizQuestion[], count: number = 10): QuizQuestion[] {
  const shuffled = shuffle(pool)

  // Pass 1: pick 1 question per unique film (diverse selection)
  const usedFilms = new Set<number>()
  const diverse: QuizQuestion[] = []
  const rest: QuizQuestion[] = []

  for (const q of shuffled) {
    if (!usedFilms.has(q.source_film.tmdb_id)) {
      usedFilms.add(q.source_film.tmdb_id)
      diverse.push(q)
    } else {
      rest.push(q)
    }
  }

  // If we have enough diverse questions, balance by difficulty
  if (diverse.length >= count) {
    return balanceByDifficulty(diverse, count)
  }

  // Not enough unique films — fill with duplicates
  const combined = [...diverse, ...shuffle(rest)]
  return balanceByDifficulty(combined, count)
}

function balanceByDifficulty(pool: QuizQuestion[], count: number): QuizQuestion[] {
  const easy = pool.filter(q => q.difficulty === 'easy')
  const medium = pool.filter(q => q.difficulty === 'medium')
  const hard = pool.filter(q => q.difficulty === 'hard')

  const selected: QuizQuestion[] = []

  const take = (arr: QuizQuestion[], n: number) => {
    const taken = arr.splice(0, n)
    selected.push(...taken)
    return taken.length
  }

  let remaining = count
  remaining -= take(easy, Math.min(3, remaining))
  remaining -= take(medium, Math.min(4, remaining))
  remaining -= take(hard, Math.min(3, remaining))

  if (remaining > 0) {
    take([...easy, ...medium, ...hard], remaining)
  }

  return shuffle(selected).slice(0, count)
}

/** Generate questions from two films (duel mode) — roughly balanced between both */
export function generateQuestionsFromTwoFilms(
  movie1: TmdbMovieDetail,
  movie2: TmdbMovieDetail,
  count: number = 10
): QuizQuestion[] {
  const pool1 = generateQuestions(movie1)
  const pool2 = generateQuestions(movie2)

  // Try to balance: ~half from each film
  const half = Math.ceil(count / 2)
  const selected1 = selectQuestions(pool1, half)
  const selected2 = selectQuestions(pool2, count - selected1.length)

  // If one film didn't have enough, fill from the other
  const combined = [...selected1, ...selected2]
  if (combined.length < count) {
    const remaining = [...pool1, ...pool2].filter(q => !combined.includes(q))
    combined.push(...remaining.slice(0, count - combined.length))
  }

  return shuffle(combined).slice(0, count)
}

/** Create initial empty QuizData */
export function createEmptyQuizData(): QuizData {
  return {
    questions: [],
    current_index: 0,
    question_started_at: '',
    answers_user1: [],
    answers_user2: [],
    times_user1: [],
    times_user2: [],
    scores: [0, 0],
    phase: 'generating',
  }
}

/** Generate poster questions from a list of movies (for poster theme) */
export function generatePosterQuestions(
  movies: { id: number; title: string; poster_path: string | null }[],
  count: number = 10
): QuizQuestion[] {
  // Only movies with posters
  const withPosters = movies.filter(m => m.poster_path)
  if (withPosters.length < 4) return []

  const questions: QuizQuestion[] = []
  const shuffled = shuffle(withPosters)

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const correct = shuffled[i]
    // Pick 3 wrong titles from other movies
    const wrongs = shuffle(withPosters.filter(m => m.id !== correct.id))
      .slice(0, 3)
      .map(m => m.title)

    if (wrongs.length < 3) continue

    const { options, correct_index } = buildOptions(correct.title, wrongs)
    questions.push({
      id: makeId(),
      type: 'poster',
      difficulty: 'medium',
      text: 'Quel est ce film ?',
      options,
      correct_index,
      source_film: { tmdb_id: correct.id, title: correct.title },
      poster_path: correct.poster_path,
    })
  }

  return shuffle(questions).slice(0, count)
}

/** Calculate score for an answer */
export function calculateScore(correct: boolean, timeMs: number): number {
  if (!correct) return 0
  return 100 + Math.max(0, 100 - Math.floor(timeMs / 150))
}
