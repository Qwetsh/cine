import { tmdb } from './tmdb'
import type { TmdbPersonCredit } from './tmdb'

export interface PeekEntry {
  key: string
  mediaType: 'movie' | 'tv'
  tmdbId: number
  title: string
  year: number | null
  posterPath: string
  /** Nom du personnage joué (acteur) ou « Réalisation » (crew) */
  sub: string | null
  popularity: number
}

// Cache en mémoire des filmographies (préchargées dès le pointerdown,
// prêtes quand le liseré a fait le tour)
const cache = new Map<number, Promise<PeekEntry[]>>()

function toEntry(credit: TmdbPersonCredit, sub: string | null): PeekEntry | null {
  if (!credit.poster_path) return null
  const title = credit.media_type === 'tv' ? credit.name : credit.title
  if (!title) return null
  const date = credit.media_type === 'tv' ? credit.first_air_date : credit.release_date
  return {
    key: `${credit.media_type}-${credit.id}`,
    mediaType: credit.media_type,
    tmdbId: credit.id,
    title,
    year: date ? new Date(date).getFullYear() : null,
    posterPath: credit.poster_path,
    sub,
    popularity: credit.popularity ?? 0,
  }
}

/**
 * Filmographie condensée d'une personne pour le peek : rôles joués
 * (avec le nom du personnage) + réalisations, triés par popularité.
 */
export function fetchPeekFilmography(personId: number): Promise<PeekEntry[]> {
  let promise = cache.get(personId)
  if (!promise) {
    promise = tmdb.getPersonCombinedCredits(personId).then(res => {
      const byKey = new Map<string, PeekEntry>()
      for (const c of res.cast) {
        const entry = toEntry(c, c.character?.trim() ? c.character : null)
        if (entry && !byKey.has(entry.key)) byKey.set(entry.key, entry)
      }
      for (const c of res.crew) {
        if (c.job !== 'Director') continue
        const entry = toEntry(c, 'Réalisation')
        // Un rôle joué prime sur le crédit de réalisation (ex. acteur-réalisateur)
        if (entry && !byKey.has(entry.key)) byKey.set(entry.key, entry)
      }
      return [...byKey.values()]
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 20)
    })
    promise.catch(() => cache.delete(personId))
    cache.set(personId, promise)
  }
  return promise
}
