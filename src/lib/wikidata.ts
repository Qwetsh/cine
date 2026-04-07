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

// --- Google Books rate limiting & cache ---
// Nettoyage one-shot : supprime les entrées gbooks vides (429 cachés par erreur)
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k?.startsWith('gbooks_')) {
      const v = JSON.parse(localStorage.getItem(k)!)
      if (!v.coverUrl && !v.isEbook && !v.infoLink) localStorage.removeItem(k)
    }
  }
} catch { /* ignore */ }

const gbooksCache = new Map<string, GoogleBooksData>()

function loadGbooksCache(key: string): GoogleBooksData | undefined {
  if (gbooksCache.has(key)) return gbooksCache.get(key)!
  try {
    const stored = localStorage.getItem(`gbooks_${key}`)
    if (stored) {
      const parsed = JSON.parse(stored) as GoogleBooksData
      gbooksCache.set(key, parsed)
      return parsed
    }
  } catch { /* ignore */ }
  return undefined
}

function saveGbooksCache(key: string, value: GoogleBooksData) {
  gbooksCache.set(key, value)
  try {
    localStorage.setItem(`gbooks_${key}`, JSON.stringify(value))
  } catch { /* ignore */ }
}

// Queue séquentielle : espace les requêtes Google Books pour éviter les 429
let gbooksQueue: Promise<void> = Promise.resolve()
const GBOOKS_DELAY_MS = 500

function enqueueGbooks<T>(fn: () => Promise<T>): Promise<T> {
  const result = gbooksQueue.then(fn)
  gbooksQueue = result.then(
    () => new Promise(r => setTimeout(r, GBOOKS_DELAY_MS)),
    () => new Promise(r => setTimeout(r, GBOOKS_DELAY_MS)),
  )
  return result
}

async function fetchGoogleBooksRaw(q: string, retries = 2): Promise<Response | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url)
    if (res.status !== 429) return res
    // Backoff exponentiel : 2s, 5s, 10s
    await new Promise(r => setTimeout(r, [2000, 5000, 10000][i]))
  }
  return null
}

/**
 * Cherche les infos du livre via Google Books API (gratuit, sans clé).
 * Avec cache sessionStorage et rate limiting.
 */
async function fetchGoogleBooksData(title: string | null, author: string | null): Promise<GoogleBooksData> {
  const empty: GoogleBooksData = { coverUrl: null, isEbook: false, infoLink: null }
  if (!title) return empty

  const cacheKey = `${title}|${author ?? ''}`
  const cached = loadGbooksCache(cacheKey)
  if (cached !== undefined) return cached

  return enqueueGbooks(async () => {
    // Re-check cache après attente dans la queue
    const cached2 = loadGbooksCache(cacheKey)
    if (cached2 !== undefined) return cached2

    try {
      const q = author
        ? `intitle:${title}+inauthor:${author}`
        : `intitle:${title}`
      const res = await fetchGoogleBooksRaw(q)
      if (!res) return empty // 429 après retries — ne PAS cacher, on retentera
      if (!res.ok) {
        saveGbooksCache(cacheKey, empty)
        return empty
      }
      const data = await res.json()
      const item = data.items?.[0]
      if (!item) {
        saveGbooksCache(cacheKey, empty)
        return empty
      }
      const thumbnail = item.volumeInfo?.imageLinks?.thumbnail
      const result: GoogleBooksData = {
        coverUrl: thumbnail ? thumbnail.replace('http://', 'https://') : null,
        isEbook: item.saleInfo?.isEbook === true,
        infoLink: item.volumeInfo?.infoLink ?? null,
      }
      saveGbooksCache(cacheKey, result)
      return result
    } catch {
      return empty // Erreur réseau — ne pas cacher, on retentera
    }
  })
}

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

// Déduplication des appels en vol — évite les doubles requêtes (React StrictMode, re-renders)
const inflight = new Map<string, Promise<BookSourceInfo | null>>()

/**
 * Interroge Wikidata via SPARQL pour trouver l'œuvre source (P144) d'un film.
 */
export function fetchBookSource(wikidataId: string): Promise<BookSourceInfo | null> {
  const cached = loadCache(wikidataId)
  if (cached !== undefined) return Promise.resolve(cached)

  // Si un appel est déjà en vol pour ce wikidataId, retourner la même promesse
  if (inflight.has(wikidataId)) return inflight.get(wikidataId)!

  const promise = _fetchBookSource(wikidataId)
  inflight.set(wikidataId, promise)
  promise.finally(() => inflight.delete(wikidataId))
  return promise
}

async function _fetchBookSource(wikidataId: string): Promise<BookSourceInfo | null> {
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
