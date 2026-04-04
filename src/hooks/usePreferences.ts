import { useMemo } from 'react'
import type { CollectionMovieEntry, PersonalCollectionEntry } from '../types'

export interface Preferences {
  topGenres: string[]          // sorted by frequency desc
  genreWeights: Record<string, number>
  yearRange: [number, number]  // min-max of watched films
  avgYear: number
}

const EMPTY: Preferences = {
  topGenres: [],
  genreWeights: {},
  yearRange: [2000, new Date().getFullYear()],
  avgYear: 2015,
}

/** Build a preference profile from collection entries */
export function usePreferences(
  coupleEntries: CollectionMovieEntry[],
  personalEntries: PersonalCollectionEntry[],
): Preferences {
  return useMemo(() => {
    const allMovies = [
      ...coupleEntries.map(e => e.movie),
      ...personalEntries.map(e => e.movie),
    ]

    if (allMovies.length === 0) return EMPTY

    // Genre frequency
    const genreCount: Record<string, number> = {}
    for (const m of allMovies) {
      for (const g of m.genres ?? []) {
        genreCount[g] = (genreCount[g] ?? 0) + 1
      }
    }

    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g)

    const total = Object.values(genreCount).reduce((a, b) => a + b, 0)
    const genreWeights: Record<string, number> = {}
    for (const [g, c] of Object.entries(genreCount)) {
      genreWeights[g] = c / total
    }

    // Year stats
    const years = allMovies
      .map(m => m.release_date ? new Date(m.release_date).getFullYear() : 0)
      .filter(y => y > 1900)

    const yearRange: [number, number] = years.length > 0
      ? [Math.min(...years), Math.max(...years)]
      : [2000, new Date().getFullYear()]

    const avgYear = years.length > 0
      ? Math.round(years.reduce((a, b) => a + b, 0) / years.length)
      : 2015

    return { topGenres, genreWeights, yearRange, avgYear }
  }, [coupleEntries, personalEntries])
}
