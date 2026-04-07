export interface GameInfo {
  wikidataId: string
  title: string
  year: number | null
  coverUrl: string | null
  genres: string[]
  platforms: string[]
  publishers: string[]
  description: string | null
}

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const RAWG_KEY = import.meta.env.VITE_RAWG_API_KEY ?? null

// Cache localStorage
const gameCache = new Map<string, GameInfo[]>()

function loadCache(key: string): GameInfo[] | undefined {
  if (gameCache.has(key)) return gameCache.get(key)!
  try {
    const stored = localStorage.getItem(`games_${key}`)
    if (stored) {
      const parsed = JSON.parse(stored) as GameInfo[]
      gameCache.set(key, parsed)
      return parsed
    }
  } catch { /* ignore */ }
  return undefined
}

function saveCache(key: string, value: GameInfo[]) {
  gameCache.set(key, value)
  try {
    localStorage.setItem(`games_${key}`, JSON.stringify(value))
  } catch { /* ignore */ }
}

// Dédup inflight
const inflight = new Map<string, Promise<GameInfo[]>>()

export function fetchRelatedGames(wikidataId: string, _movieTitle: string): Promise<GameInfo[]> {
  const cached = loadCache(wikidataId)
  if (cached !== undefined) return Promise.resolve(cached)

  if (inflight.has(wikidataId)) return inflight.get(wikidataId)!

  const promise = _fetchRelatedGames(wikidataId)
  inflight.set(wikidataId, promise)
  promise.finally(() => inflight.delete(wikidataId))
  return promise
}

interface SparqlBinding {
  game?: { value: string }
  gameLabel?: { value: string }
  date?: { value: string }
  genreLabel?: { value: string }
  publisherLabel?: { value: string }
  platformLabel?: { value: string }
}

async function _fetchRelatedGames(wikidataId: string): Promise<GameInfo[]> {
  try {
    const query = `
SELECT DISTINCT ?game ?gameLabel ?date ?genreLabel ?publisherLabel ?platformLabel WHERE {
  BIND(wd:${wikidataId} AS ?film)
  {
    ?film wdt:P4969 ?game .
  } UNION {
    ?film wdt:P8345 ?franchise .
    ?game wdt:P8345 ?franchise .
  } UNION {
    ?film wdt:P144 ?source .
    ?game wdt:P144 ?source .
  } UNION {
    ?film wdt:P144 ?source .
    ?game wdt:P8345 ?source .
  } UNION {
    ?film wdt:P144 ?source .
    ?source wdt:P179 ?series .
    { ?game wdt:P144 ?series . }
    UNION { ?series wdt:P4969 ?game . }
  }
  ?game wdt:P31/wdt:P279* wd:Q7889 .
  FILTER(?game != ?film)
  OPTIONAL { ?game wdt:P577 ?date . }
  OPTIONAL { ?game wdt:P136 ?genre . }
  OPTIONAL { ?game wdt:P123 ?publisher . }
  OPTIONAL { ?game wdt:P400 ?platform . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
} LIMIT 200`

    const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: { Accept: 'application/sparql-results+json' },
    })

    if (!res.ok) {
      saveCache(wikidataId, [])
      return []
    }

    const data = await res.json()
    const bindings: SparqlBinding[] = data.results?.bindings ?? []

    if (bindings.length === 0) {
      saveCache(wikidataId, [])
      return []
    }

    // Grouper par jeu (les OPTIONAL créent des lignes multiples)
    const gamesMap = new Map<string, {
      id: string
      title: string
      dates: Set<string>
      genres: Set<string>
      publishers: Set<string>
      platforms: Set<string>
    }>()

    for (const b of bindings) {
      const gameUri = b.game?.value ?? ''
      const gameId = gameUri.split('/').pop() ?? ''
      const title = b.gameLabel?.value ?? ''

      if (!gameId || !title) continue

      if (!gamesMap.has(gameId)) {
        gamesMap.set(gameId, {
          id: gameId,
          title,
          dates: new Set(),
          genres: new Set(),
          publishers: new Set(),
          platforms: new Set(),
        })
      }

      const g = gamesMap.get(gameId)!
      if (b.date?.value) g.dates.add(b.date.value.slice(0, 4))
      if (b.genreLabel?.value) g.genres.add(b.genreLabel.value)
      if (b.publisherLabel?.value) g.publishers.add(b.publisherLabel.value)
      if (b.platformLabel?.value) g.platforms.add(b.platformLabel.value)
    }

    // Convertir en GameInfo[]
    let games: GameInfo[] = [...gamesMap.values()].map(g => {
      const years = [...g.dates].map(Number).filter(y => y > 1970).sort()
      return {
        wikidataId: g.id,
        title: g.title,
        year: years.length > 0 ? years[0] : null,
        coverUrl: null,
        genres: [...g.genres].slice(0, 5),
        platforms: [...g.platforms].slice(0, 8),
        publishers: [...g.publishers].slice(0, 3),
        description: null,
      }
    })

    // Trier par année
    games.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))

    // Fetch RAWG covers si clé disponible
    if (RAWG_KEY && games.length > 0) {
      await enrichWithRawg(games)
    }

    saveCache(wikidataId, games)
    return games
  } catch {
    saveCache(wikidataId, [])
    return []
  }
}

async function enrichWithRawg(games: GameInfo[]) {
  // Limiter à 10 requêtes RAWG max
  const toFetch = games.slice(0, 10)

  await Promise.all(
    toFetch.map(async (game) => {
      try {
        const q = encodeURIComponent(game.title)
        const res = await fetch(
          `https://api.rawg.io/api/games?search=${q}&page_size=1&key=${RAWG_KEY}`
        )
        if (!res.ok) return
        const data = await res.json()
        const result = data.results?.[0]
        if (!result) return

        game.coverUrl = result.background_image ?? null
        if (!game.description && result.slug) {
          // Fetch description séparément
          try {
            const detailRes = await fetch(
              `https://api.rawg.io/api/games/${result.id}?key=${RAWG_KEY}`
            )
            if (detailRes.ok) {
              const detail = await detailRes.json()
              game.description = detail.description_raw?.slice(0, 300) ?? null
            }
          } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    })
  )
}
