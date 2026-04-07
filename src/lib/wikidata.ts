import type { TmdbKeyword } from './tmdb'

// Keyword IDs TMDB identifiant des adaptations
export const ADAPTATION_KEYWORDS: Record<number, string> = {
  818: 'roman',
  12565: 'nouvelle',
  9717: 'bande dessinée',
  155159: 'manga',
  156279: 'roman graphique',
  189098: 'light novel',
}

const ADAPTATION_IDS = new Set(Object.keys(ADAPTATION_KEYWORDS).map(Number))

export interface BookSourceInfo {
  wikidataId: string
  title: string
  author: string | null
  publicationDate: string | null
  coverUrl: string | null
}

// Cache mémoire — données Wikidata quasi statiques
const cache = new Map<string, BookSourceInfo | null>()

/**
 * Détecte si les keywords TMDB contiennent un keyword d'adaptation.
 * Retourne le type d'adaptation ou null.
 */
export function detectAdaptation(keywords: TmdbKeyword[]): string | null {
  for (const kw of keywords) {
    if (ADAPTATION_IDS.has(kw.id)) {
      return ADAPTATION_KEYWORDS[kw.id]
    }
  }
  return null
}

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

/**
 * Interroge Wikidata via SPARQL pour trouver l'œuvre source (P144) d'un film.
 */
export async function fetchBookSource(wikidataId: string): Promise<BookSourceInfo | null> {
  if (cache.has(wikidataId)) return cache.get(wikidataId)!

  try {
    const query = `
SELECT ?book ?bookLabel ?authorName ?date WHERE {
  wd:${wikidataId} wdt:P144 ?book .
  OPTIONAL {
    ?book wdt:P50 ?author .
    ?author rdfs:label ?authorName .
    FILTER(LANG(?authorName) IN ("mul", "fr", "en"))
  }
  OPTIONAL { ?book wdt:P577 ?date . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
} LIMIT 1`

    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
    })

    if (!res.ok) {
      cache.set(wikidataId, null)
      return null
    }

    const data = await res.json()
    const bindings = data.results?.bindings
    if (!bindings || bindings.length === 0) {
      cache.set(wikidataId, null)
      return null
    }

    const b = bindings[0]
    const bookUri: string = b.book?.value ?? ''
    const bookWikidataId = bookUri.split('/').pop() ?? ''

    const result: BookSourceInfo = {
      wikidataId: bookWikidataId,
      title: b.bookLabel?.value ?? null,
      author: b.authorName?.value ?? null,
      publicationDate: b.date?.value ? b.date.value.split('T')[0] : null,
      coverUrl: null,
    }

    cache.set(wikidataId, result)
    return result
  } catch {
    cache.set(wikidataId, null)
    return null
  }
}
