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
  isEbook: boolean
  infoLink: string | null
}

// Cache mémoire + sessionStorage pour éviter les appels répétés
const cache = new Map<string, BookSourceInfo | null>()

function loadCache(key: string): BookSourceInfo | null | undefined {
  if (cache.has(key)) return cache.get(key)!
  try {
    const stored = sessionStorage.getItem(`book_${key}`)
    if (stored) {
      const parsed = JSON.parse(stored) as BookSourceInfo | null
      cache.set(key, parsed)
      return parsed
    }
  } catch { /* ignore */ }
  return undefined
}

function saveCache(key: string, value: BookSourceInfo | null) {
  cache.set(key, value)
  try {
    sessionStorage.setItem(`book_${key}`, JSON.stringify(value))
  } catch { /* ignore */ }
}

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

interface GoogleBooksData {
  coverUrl: string | null
  isEbook: boolean
  infoLink: string | null
}

/**
 * Cherche les infos du livre via Google Books API (gratuit, sans clé).
 */
async function fetchGoogleBooksData(title: string | null, author: string | null): Promise<GoogleBooksData> {
  const empty: GoogleBooksData = { coverUrl: null, isEbook: false, infoLink: null }
  if (!title) return empty
  try {
    const q = author
      ? `intitle:${title}+inauthor:${author}`
      : `intitle:${title}`
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`
    )
    if (!res.ok) return empty
    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return empty
    const thumbnail = item.volumeInfo?.imageLinks?.thumbnail
    return {
      coverUrl: thumbnail ? thumbnail.replace('http://', 'https://') : null,
      isEbook: item.saleInfo?.isEbook === true,
      infoLink: item.volumeInfo?.infoLink ?? null,
    }
  } catch {
    return empty
  }
}

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

/**
 * Interroge Wikidata via SPARQL pour trouver l'œuvre source (P144) d'un film.
 */
export async function fetchBookSource(wikidataId: string): Promise<BookSourceInfo | null> {
  const cached = loadCache(wikidataId)
  if (cached !== undefined) return cached

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
      saveCache(wikidataId, null)
      return null
    }

    const data = await res.json()
    const bindings = data.results?.bindings
    if (!bindings || bindings.length === 0) {
      saveCache(wikidataId, null)
      return null
    }

    const b = bindings[0]
    const bookUri: string = b.book?.value ?? ''
    const bookWikidataId = bookUri.split('/').pop() ?? ''

    const title = b.bookLabel?.value ?? null
    const author = b.authorName?.value ?? null
    const gbooks = await fetchGoogleBooksData(title, author)

    const result: BookSourceInfo = {
      wikidataId: bookWikidataId,
      title,
      author,
      publicationDate: b.date?.value ? b.date.value.split('T')[0] : null,
      coverUrl: gbooks.coverUrl,
      isEbook: gbooks.isEbook,
      infoLink: gbooks.infoLink,
    }

    saveCache(wikidataId, result)
    return result
  } catch {
    saveCache(wikidataId, null)
    return null
  }
}
