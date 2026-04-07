import type { TmdbKeyword } from './tmdb'

// Keyword IDs TMDB identifiant des adaptations
export const ADAPTATION_KEYWORDS: Record<number, string> = {
  818: "d'un roman",
  12565: "d'une nouvelle",
  9717: "d'une bande dessinée",
  155159: "d'un manga",
  156279: "d'un roman graphique",
  189098: "d'un light novel",
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

/**
 * Cherche une couverture de livre via Google Books API (gratuit, sans clé).
 */
async function fetchBookCover(title: string | null, author: string | null): Promise<string | null> {
  if (!title) return null
  try {
    const q = author
      ? `intitle:${title}+inauthor:${author}`
      : `intitle:${title}`
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`
    )
    if (!res.ok) return null
    const data = await res.json()
    const thumbnail = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail
    return thumbnail ? thumbnail.replace('http://', 'https://') : null
  } catch {
    return null
  }
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

    const title = b.bookLabel?.value ?? null
    const author = b.authorName?.value ?? null
    const coverUrl = await fetchBookCover(title, author)

    const result: BookSourceInfo = {
      wikidataId: bookWikidataId,
      title,
      author,
      publicationDate: b.date?.value ? b.date.value.split('T')[0] : null,
      coverUrl,
    }

    cache.set(wikidataId, result)
    return result
  } catch {
    cache.set(wikidataId, null)
    return null
  }
}
