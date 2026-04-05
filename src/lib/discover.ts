import { tmdb } from './tmdb'
import type { TmdbMovie } from './tmdb'

export type DiscoverTheme = 'actor' | 'director' | 'country' | 'decade' | 'poster' | 'general'

export type QuizDifficulty = 'easy' | 'normal' | 'hard'

/** Multiplier applied to vote_count thresholds per difficulty */
const DIFFICULTY_MULTIPLIER: Record<QuizDifficulty, number> = {
  easy: 3,
  normal: 1,
  hard: 0.3,
}

/** Max page offset per difficulty (easy = popular pages, hard = deeper pages) */
const DIFFICULTY_OFFSET: Record<QuizDifficulty, { min: number; max: number }> = {
  easy: { min: 0, max: 3 },
  normal: { min: 0, max: 10 },
  hard: { min: 3, max: 20 },
}

export const DECADES = [
  { label: '80s', start: 1980, end: 1989 },
  { label: '90s', start: 1990, end: 1999 },
  { label: '2000s', start: 2000, end: 2009 },
  { label: '2010s', start: 2010, end: 2019 },
  { label: '2020s', start: 2020, end: 2029 },
] as const

const SORT_OPTIONS = [
  'popularity.desc',
  'revenue.desc',
  'vote_count.desc',
  'vote_average.desc',
  'primary_release_date.desc',
] as const

function randomSort(): string {
  return SORT_OPTIONS[Math.floor(Math.random() * SORT_OPTIONS.length)]
}

/** Fetch pages from discover with random offset for variety */
export async function fetchRandomPages(
  params: Parameters<typeof tmdb.discoverMovies>[0],
  pages: number = 3,
  maxOffset: number = 10,
): Promise<TmdbMovie[]> {
  const offset = Math.floor(Math.random() * maxOffset)
  const sort = params.sort_by ?? randomSort()
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) =>
      tmdb.discoverMovies({ ...params, sort_by: sort, page: offset + i + 1 })
    )
  )
  return results.flatMap(r => r.results)
}

/** Discover movies by theme — shared between quiz and tournament */
export async function discoverMoviesByTheme(
  theme: DiscoverTheme,
  themeValue: string | null,
  difficulty: QuizDifficulty = 'normal',
): Promise<TmdbMovie[]> {
  const mult = DIFFICULTY_MULTIPLIER[difficulty]
  const offsetRange = DIFFICULTY_OFFSET[difficulty]

  function voteGte(base: number): string {
    return String(Math.max(1, Math.round(base * mult)))
  }

  function offset(base: number): number {
    return Math.max(offsetRange.min, Math.min(base, offsetRange.max))
  }

  switch (theme) {
    case 'actor': {
      if (!themeValue) return []
      const people = await tmdb.searchPerson(themeValue)
      const actor = people.results.find(p => p.known_for_department === 'Acting')
      if (!actor) return []
      return fetchRandomPages({
        with_cast: String(actor.id),
        'vote_count.gte': voteGte(20),
      }, 3, offset(3))
    }
    case 'director': {
      if (!themeValue) return []
      const people = await tmdb.searchPerson(themeValue)
      const director = people.results.find(p => p.known_for_department === 'Directing')
      if (!director) return []
      return fetchRandomPages({
        with_crew: String(director.id),
        'vote_count.gte': voteGte(10),
      }, 2, offset(2))
    }
    case 'country': {
      if (!themeValue) return []
      return fetchRandomPages({
        with_origin_country: themeValue,
        'vote_count.gte': voteGte(100),
      }, 3, offset(8))
    }
    case 'decade': {
      const decade = DECADES.find(d => d.label === themeValue)
      if (!decade) return []
      return fetchRandomPages({
        'primary_release_date.gte': `${decade.start}-01-01`,
        'primary_release_date.lte': `${decade.end}-12-31`,
        'vote_count.gte': voteGte(200),
      }, 3, offset(8))
    }
    case 'poster':
    case 'general':
    default: {
      return fetchRandomPages({
        'vote_count.gte': voteGte(300),
      }, 3, offset(15))
    }
  }
}
