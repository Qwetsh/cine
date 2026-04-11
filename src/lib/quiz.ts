import { tmdb } from './tmdb'
import type { TmdbMovieDetail } from './tmdb'
import { discoverMoviesByTheme, discoverMoviesByYearRange } from './discover'
import type { QuizDifficulty, DiscoverTheme } from './discover'
import {
  DECOY_DIRECTORS, DECOY_ACTORS, DECOY_COMPOSERS,
  DECOY_COUNTRIES,
} from './quiz-decoys'

// ── Types ──

export type QuestionType =
  // Existing (kept)
  | 'release_year'
  | 'genre'
  | 'director'
  | 'actor_role'
  | 'actor_not_in'
  | 'country'
  | 'poster'
  // New
  | 'budget_compare'
  | 'revenue_compare'
  | 'which_came_first'
  | 'odd_one_out'
  | 'keywords_to_movie'
  | 'backdrop_guess'
  | 'composer'
  | 'cast_to_movie'
  | 'connect_movies'

/** All question types with metadata for the setup UI */
export const QUESTION_TYPE_META: {
  id: QuestionType
  label: string
  emoji: string
  difficulty: Difficulty
}[] = [
  // Easy
  { id: 'release_year', label: 'Année de sortie', emoji: '📅', difficulty: 'easy' },
  { id: 'genre', label: 'Genre', emoji: '🎭', difficulty: 'easy' },
  { id: 'which_came_first', label: 'Sorti en premier', emoji: '⏳', difficulty: 'easy' },
  // Medium
  { id: 'director', label: 'Réalisateur', emoji: '🎬', difficulty: 'medium' },
  { id: 'actor_role', label: 'Rôle acteur', emoji: '🎭', difficulty: 'medium' },
  { id: 'actor_not_in', label: 'Acteur absent', emoji: '❌', difficulty: 'medium' },
  { id: 'poster', label: 'Affiche floue', emoji: '🖼️', difficulty: 'medium' },
  { id: 'backdrop_guess', label: 'Image du film', emoji: '📸', difficulty: 'medium' },
  { id: 'revenue_compare', label: 'Box-office', emoji: '💰', difficulty: 'medium' },
  { id: 'odd_one_out', label: "L'intrus", emoji: '🔍', difficulty: 'medium' },
  { id: 'cast_to_movie', label: 'Casting → Film', emoji: '🎬', difficulty: 'medium' },
  // Hard
  { id: 'country', label: 'Pays', emoji: '🌍', difficulty: 'hard' },
  { id: 'composer', label: 'Compositeur', emoji: '🎵', difficulty: 'hard' },
  { id: 'budget_compare', label: 'Budget', emoji: '💸', difficulty: 'hard' },
  { id: 'keywords_to_movie', label: 'Mots-clés', emoji: '🔑', difficulty: 'hard' },
  { id: 'connect_movies', label: 'Point commun', emoji: '🔗', difficulty: 'hard' },
]

export const ALL_QUESTION_TYPES: QuestionType[] = QUESTION_TYPE_META.map(q => q.id)

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface FilmPoster {
  tmdb_id: number
  title: string
  poster_path: string | null
}

export interface QuizQuestion {
  id: string
  type: QuestionType
  difficulty: Difficulty
  text: string
  options: string[]
  correct_index: number
  source_film: { tmdb_id: number; title: string }
  /** Poster path for 'poster' type questions */
  poster_path?: string | null
  /** Backdrop path for 'backdrop_guess' type */
  backdrop_path?: string | null
  /** Film posters for comparison questions (budget, revenue, first, odd_one_out) */
  film_posters?: FilmPoster[]
  /** Keyword pills for 'keywords_to_movie' type */
  keyword_pills?: string[]
  /** Actor names for 'cast_to_movie' type */
  cast_names?: string[]
  /** Film posters shown as prompt for 'connect_movies' type */
  connect_films?: FilmPoster[]
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

function getComposer(movie: TmdbMovieDetail): string | null {
  return movie.credits?.crew.find(
    c => c.job === 'Original Music Composer' || c.job === 'Music' || c.job === 'Composer'
  )?.name ?? null
}

function toFilmPoster(movie: TmdbMovieDetail): FilmPoster {
  return { tmdb_id: movie.id, title: movie.title, poster_path: movie.poster_path }
}

// ── Single-movie question generators ──

function yearQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  if (!movie.release_date) return null
  const year = new Date(movie.release_date).getFullYear()

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

function composerQuestion(movie: TmdbMovieDetail): QuizQuestion | null {
  const composer = getComposer(movie)
  if (!composer) return null

  const wrongs = pickRandom(DECOY_COMPOSERS.filter(c => c !== composer), 3)
  if (wrongs.length < 3) return null

  const { options, correct_index } = buildOptions(composer, wrongs)
  return {
    id: makeId(),
    type: 'composer',
    difficulty: 'hard',
    text: `Qui a composé la musique de "${movie.title}" ?`,
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
  }
}

// ── Pool-aware single-movie generators ──

function backdropGuessQuestion(movie: TmdbMovieDetail, pool: TmdbMovieDetail[]): QuizQuestion | null {
  if (!movie.backdrop_path) return null
  const others = pool.filter(m => m.id !== movie.id && m.title !== movie.title)
  if (others.length < 3) return null

  const wrongs = pickRandom(others, 3).map(m => m.title)
  const { options, correct_index } = buildOptions(movie.title, wrongs)
  return {
    id: makeId(),
    type: 'backdrop_guess',
    difficulty: 'medium',
    text: 'Quel est ce film ?',
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
    backdrop_path: movie.backdrop_path,
  }
}

function keywordsToMovieQuestion(movie: TmdbMovieDetail, pool: TmdbMovieDetail[]): QuizQuestion | null {
  const keywords = movie.keywords?.keywords
  if (!keywords || keywords.length < 3) return null
  const others = pool.filter(m => m.id !== movie.id)
  if (others.length < 3) return null

  const pills = pickRandom(keywords, Math.min(5, keywords.length)).map(k => k.name)
  const wrongs = pickRandom(others, 3).map(m => m.title)
  const { options, correct_index } = buildOptions(movie.title, wrongs)

  return {
    id: makeId(),
    type: 'keywords_to_movie',
    difficulty: 'hard',
    text: 'Quel film correspond à ces mots-clés ?',
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
    keyword_pills: pills,
  }
}

function castToMovieQuestion(movie: TmdbMovieDetail, pool: TmdbMovieDetail[]): QuizQuestion | null {
  const cast = movie.credits?.cast
  if (!cast || cast.length < 3) return null
  const others = pool.filter(m => m.id !== movie.id)
  if (others.length < 3) return null

  const actors = pickRandom(cast.slice(0, 8), 3).map(c => c.name)
  const wrongs = pickRandom(others, 3).map(m => m.title)
  const { options, correct_index } = buildOptions(movie.title, wrongs)

  return {
    id: makeId(),
    type: 'cast_to_movie',
    difficulty: 'medium',
    text: 'Quel film réunit ces acteurs ?',
    options,
    correct_index,
    source_film: { tmdb_id: movie.id, title: movie.title },
    cast_names: actors,
  }
}

// ── Multi-movie generators ──

function budgetCompareQuestion(pool: TmdbMovieDetail[]): QuizQuestion | null {
  const withBudget = pool.filter(m => m.budget > 1_000_000)
  if (withBudget.length < 4) return null

  const picked = pickRandom(withBudget, 4)
  const sorted = [...picked].sort((a, b) => b.budget - a.budget)
  const correct = sorted[0]

  const options = picked.map(m => m.title)
  const shuffled = shuffle(options)
  return {
    id: makeId(),
    type: 'budget_compare',
    difficulty: 'hard',
    text: 'Quel film a eu le plus gros budget ?',
    options: shuffled,
    correct_index: shuffled.indexOf(correct.title),
    source_film: { tmdb_id: correct.id, title: correct.title },
    film_posters: picked.map(toFilmPoster),
  }
}

function revenueCompareQuestion(pool: TmdbMovieDetail[]): QuizQuestion | null {
  const withRevenue = pool.filter(m => m.revenue > 1_000_000)
  if (withRevenue.length < 4) return null

  const picked = pickRandom(withRevenue, 4)
  const sorted = [...picked].sort((a, b) => b.revenue - a.revenue)
  const correct = sorted[0]

  const options = picked.map(m => m.title)
  const shuffled = shuffle(options)
  return {
    id: makeId(),
    type: 'revenue_compare',
    difficulty: 'medium',
    text: 'Quel film a rapporté le plus au box-office ?',
    options: shuffled,
    correct_index: shuffled.indexOf(correct.title),
    source_film: { tmdb_id: correct.id, title: correct.title },
    film_posters: picked.map(toFilmPoster),
  }
}

function whichCameFirstQuestion(pool: TmdbMovieDetail[]): QuizQuestion | null {
  const withDate = pool.filter(m => m.release_date)
  if (withDate.length < 4) return null

  const picked = pickRandom(withDate, 4)
  // Ensure they have different years for a meaningful question
  const years = new Set(picked.map(m => new Date(m.release_date).getFullYear()))
  if (years.size < 3) return null

  const sorted = [...picked].sort(
    (a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
  )
  const correct = sorted[0]

  const options = picked.map(m => m.title)
  const shuffled = shuffle(options)
  return {
    id: makeId(),
    type: 'which_came_first',
    difficulty: 'easy',
    text: 'Quel film est sorti en premier ?',
    options: shuffled,
    correct_index: shuffled.indexOf(correct.title),
    source_film: { tmdb_id: correct.id, title: correct.title },
    film_posters: picked.map(toFilmPoster),
  }
}

function oddOneOutQuestion(pool: TmdbMovieDetail[]): QuizQuestion | null {
  // Try to find 3 films sharing a genre + 1 that doesn't
  const genreMap = new Map<string, TmdbMovieDetail[]>()
  for (const m of pool) {
    for (const g of m.genres ?? []) {
      const list = genreMap.get(g.name) ?? []
      list.push(m)
      genreMap.set(g.name, list)
    }
  }

  // Find a genre shared by at least 3 films
  for (const [genreName, films] of genreMap) {
    if (films.length < 3) continue
    const group = pickRandom(films, 3)
    const groupIds = new Set(group.map(m => m.id))
    const outsider = pool.find(
      m => !groupIds.has(m.id) && !(m.genres ?? []).some(g => g.name === genreName)
    )
    if (!outsider) continue

    const all = shuffle([...group, outsider])
    const options = all.map(m => m.title)
    return {
      id: makeId(),
      type: 'odd_one_out',
      difficulty: 'medium',
      text: `Un de ces films n'est pas du genre "${genreName}". Lequel ?`,
      options,
      correct_index: options.indexOf(outsider.title),
      source_film: { tmdb_id: outsider.id, title: outsider.title },
      film_posters: all.map(toFilmPoster),
    }
  }

  return null
}

function connectMoviesQuestion(pool: TmdbMovieDetail[]): QuizQuestion | null {
  // Find 3 films sharing an actor, and generate wrong answer options
  const actorMap = new Map<string, TmdbMovieDetail[]>()
  for (const m of pool) {
    for (const c of (m.credits?.cast ?? []).slice(0, 10)) {
      const list = actorMap.get(c.name) ?? []
      list.push(m)
      actorMap.set(c.name, list)
    }
  }

  for (const [actorName, films] of actorMap) {
    if (films.length < 3) continue
    const group = pickRandom(films, 3)

    // Wrong options: other actors, a genre, a director
    const director = getDirector(group[0])
    const wrongActors = pickRandom(
      DECOY_ACTORS.filter(a => a !== actorName),
      2
    )
    const wrongDirector = director
      ? pickRandom(DECOY_DIRECTORS.filter(d => d !== director), 1)[0]
      : pickRandom(DECOY_DIRECTORS, 1)[0]

    const wrongs = [...wrongActors, wrongDirector].slice(0, 3)
    if (wrongs.length < 3) continue

    const { options, correct_index } = buildOptions(actorName, wrongs)
    return {
      id: makeId(),
      type: 'connect_movies',
      difficulty: 'hard',
      text: "Qu'ont ces 3 films en commun ?",
      options,
      correct_index,
      source_film: { tmdb_id: group[0].id, title: group[0].title },
      connect_films: group.map(toFilmPoster),
    }
  }

  return null
}

// ── Public API ──

const SINGLE_GENERATORS: ((movie: TmdbMovieDetail) => QuizQuestion | null)[] = [
  yearQuestion,
  genreQuestion,
  directorQuestion,
  actorRoleQuestion,
  actorNotInQuestion,
  countryQuestion,
  composerQuestion,
]

type PoolAwareSingleGen = (movie: TmdbMovieDetail, pool: TmdbMovieDetail[]) => QuizQuestion | null
const POOL_AWARE_SINGLE_GENERATORS: { type: QuestionType; gen: PoolAwareSingleGen }[] = [
  { type: 'backdrop_guess', gen: backdropGuessQuestion },
  { type: 'keywords_to_movie', gen: keywordsToMovieQuestion },
  { type: 'cast_to_movie', gen: castToMovieQuestion },
]

type MultiMovieGen = (pool: TmdbMovieDetail[]) => QuizQuestion | null
const MULTI_GENERATORS: { type: QuestionType; gen: MultiMovieGen }[] = [
  { type: 'budget_compare', gen: budgetCompareQuestion },
  { type: 'revenue_compare', gen: revenueCompareQuestion },
  { type: 'which_came_first', gen: whichCameFirstQuestion },
  { type: 'odd_one_out', gen: oddOneOutQuestion },
  { type: 'connect_movies', gen: connectMoviesQuestion },
]

// Keep old GENERATORS array for backward compat (tournament-questions.ts)
const GENERATORS: ((movie: TmdbMovieDetail) => QuizQuestion | null)[] = SINGLE_GENERATORS

/** Generate all possible questions from a single movie (legacy, used by tournament) */
export function generateQuestions(movie: TmdbMovieDetail): QuizQuestion[] {
  const questions: QuizQuestion[] = []
  for (const gen of GENERATORS) {
    const q = gen(movie)
    if (q) questions.push(q)
  }
  return questions
}

/** Generate all questions from a movie pool (single + pool-aware + multi) */
function generateAllQuestions(
  movies: TmdbMovieDetail[],
  enabledTypes: QuestionType[],
): QuizQuestion[] {
  const pool: QuizQuestion[] = []
  const enabled = new Set(enabledTypes)

  // Single-movie generators
  for (const movie of movies) {
    for (const gen of SINGLE_GENERATORS) {
      const q = gen(movie)
      if (q && enabled.has(q.type)) pool.push(q)
    }

    // Pool-aware single generators
    for (const { type, gen } of POOL_AWARE_SINGLE_GENERATORS) {
      if (!enabled.has(type)) continue
      const q = gen(movie, movies)
      if (q) pool.push(q)
    }
  }

  // Multi-movie generators (multiple attempts for variety)
  for (const { type, gen } of MULTI_GENERATORS) {
    if (!enabled.has(type)) continue
    // Generate several questions of this type
    for (let attempt = 0; attempt < 5; attempt++) {
      const q = gen(shuffle(movies))
      if (q) pool.push(q)
    }
  }

  // Poster questions (special generator)
  if (enabled.has('poster')) {
    const posterQs = generatePosterQuestions(
      movies.map(m => ({ id: m.id, title: m.title, poster_path: m.poster_path })),
      5
    )
    pool.push(...posterQs)
  }

  return pool
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

  // Also try to diversify by question type
  if (diverse.length >= count) {
    return balanceByDifficulty(diverse, count)
  }

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
  remaining -= take(easy, Math.min(Math.ceil(count * 0.25), remaining))
  remaining -= take(medium, Math.min(Math.ceil(count * 0.4), remaining))
  remaining -= take(hard, Math.min(remaining, remaining))

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

  const half = Math.ceil(count / 2)
  const selected1 = selectQuestions(pool1, half)
  const selected2 = selectQuestions(pool2, count - selected1.length)

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
  const withPosters = movies.filter(m => m.poster_path)
  if (withPosters.length < 4) return []

  const questions: QuizQuestion[] = []
  const shuffled = shuffle(withPosters)

  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const correct = shuffled[i]
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

/**
 * Generate quiz questions — new pipeline with year range and question type selection.
 * Also supports legacy theme-based mode for backward compatibility.
 */
export async function generateQuizQuestions(config: {
  // New config
  difficulty?: QuizDifficulty
  yearMin?: number
  yearMax?: number
  enabledTypes?: QuestionType[]
  count?: number
  // Fight mode
  film1TmdbId?: number
  film2TmdbId?: number
  // Legacy config (for backward compat with old QuizMode/tournament)
  type?: 'classic' | 'fight'
  theme?: string | null
  themeValue?: string | null
}): Promise<QuizQuestion[]> {
  const count = config.count ?? 10
  const enabledTypes = config.enabledTypes ?? ALL_QUESTION_TYPES
  const difficulty = config.difficulty ?? 'normal'

  // Fight mode: questions from two specific films
  if (config.film1TmdbId && config.film2TmdbId) {
    const [m1, m2] = await Promise.all([
      tmdb.getMovie(config.film1TmdbId),
      tmdb.getMovie(config.film2TmdbId),
    ])
    return generateQuestionsFromTwoFilms(m1, m2, count)
  }

  // Legacy theme-based mode (for backward compat)
  if (config.theme && config.theme !== 'general') {
    const theme = config.theme as DiscoverTheme
    const movies = await discoverMoviesByTheme(
      theme,
      config.themeValue ?? null,
      difficulty,
    )

    if (theme === 'poster') {
      return generatePosterQuestions(movies, count)
    }

    const shuffled = shuffle([...movies])
    const picked = shuffled.slice(0, 12)
    const details = await Promise.all(picked.map(m => tmdb.getMovie(m.id)))
    const pool = details.flatMap(m => generateQuestions(m))
    return selectQuestions(pool, count)
  }

  // New year-range based mode
  const yearMin = config.yearMin ?? 1970
  const yearMax = config.yearMax ?? new Date().getFullYear()

  const movies = await discoverMoviesByYearRange(yearMin, yearMax, difficulty)
  if (movies.length === 0) return []

  const shuffled = shuffle([...movies])
  const picked = shuffled.slice(0, Math.min(20, shuffled.length))
  const details = await Promise.all(picked.map(m => tmdb.getMovie(m.id)))

  const pool = generateAllQuestions(details, enabledTypes)
  return selectQuestions(pool, count)
}
