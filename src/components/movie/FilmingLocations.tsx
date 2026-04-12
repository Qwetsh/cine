import { useEffect, useState, lazy, Suspense } from 'react'

interface FilmingLocation {
  name: string
  lat: number
  lng: number
  image: string | null
  type: 'filming' | 'narrative'
}

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

function buildLocationQuery(imdbId: string, property: 'P915' | 'P840'): string {
  return `
SELECT DISTINCT ?locationLabel ?lat ?lon ?image WHERE {
  ?film wdt:P345 "${imdbId}" .
  ?film wdt:${property} ?location .
  ?location wdt:P625 ?coord .
  OPTIONAL { ?location wdt:P18 ?image . }
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
}
LIMIT 50
`.trim()
}

function parseLocations(data: { results: { bindings: Record<string, { value: string }>[] } }, type: 'filming' | 'narrative'): FilmingLocation[] {
  const seen = new Set<string>()
  return data.results.bindings
    .map((b: Record<string, { value: string }>) => {
      const rawImage = b.image?.value ?? null
      let image: string | null = null
      if (rawImage) {
        const u = rawImage.replace('http://', 'https://')
        image = u.includes('Special:FilePath')
          ? `${u}${u.includes('?') ? '&' : '?'}width=400`
          : u
      }
      return {
        name: b.locationLabel?.value ?? 'Lieu inconnu',
        lat: parseFloat(b.lat?.value),
        lng: parseFloat(b.lon?.value),
        image,
        type,
      }
    })
    .filter((l: FilmingLocation) => {
      if (isNaN(l.lat) || isNaN(l.lng)) return false
      const key = l.name
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

async function fetchSparql(query: string) {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetch(url, { headers: { 'Accept': 'application/sparql-results+json' } })
  if (!res.ok) return null
  return res.json()
}

async function fetchFilmingLocations(imdbId: string): Promise<FilmingLocation[]> {
  const [filmingData, narrativeData] = await Promise.all([
    fetchSparql(buildLocationQuery(imdbId, 'P915')).catch(() => null),
    fetchSparql(buildLocationQuery(imdbId, 'P840')).catch(() => null),
  ])

  const filming = filmingData ? parseLocations(filmingData, 'filming') : []
  const narrative = narrativeData ? parseLocations(narrativeData, 'narrative') : []

  return [...filming, ...narrative]
}

async function fetchWikipediaFilmingSection(imdbId: string): Promise<string | null> {
  try {
    // Step 1: Get Wikipedia article title from Wikidata
    const sparql = `SELECT ?article WHERE {
      ?film wdt:P345 "${imdbId}" .
      ?article schema:about ?film ;
               schema:isPartOf <https://fr.wikipedia.org/> .
    } LIMIT 1`
    const wdUrl = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}&format=json`
    const wdRes = await fetch(wdUrl, { headers: { 'Accept': 'application/sparql-results+json' } })
    if (!wdRes.ok) return null
    const wdData = await wdRes.json()
    const articleUrl = wdData.results.bindings[0]?.article?.value
    if (!articleUrl) {
      // Fallback: try English Wikipedia
      const sparqlEn = `SELECT ?article WHERE {
        ?film wdt:P345 "${imdbId}" .
        ?article schema:about ?film ;
                 schema:isPartOf <https://en.wikipedia.org/> .
      } LIMIT 1`
      const wdUrlEn = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(sparqlEn)}&format=json`
      const wdResEn = await fetch(wdUrlEn, { headers: { 'Accept': 'application/sparql-results+json' } })
      if (!wdResEn.ok) return null
      const wdDataEn = await wdResEn.json()
      const articleUrlEn = wdDataEn.results.bindings[0]?.article?.value
      if (!articleUrlEn) return null
      return fetchWikiSection(articleUrlEn, 'en')
    }
    return fetchWikiSection(articleUrl, 'fr')
  } catch {
    return null
  }
}

async function fetchWikiSection(articleUrl: string, lang: string): Promise<string | null> {
  const title = decodeURIComponent(articleUrl.split('/wiki/')[1])
  if (!title) return null

  // Get sections list
  const sectionsUrl = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`
  const sectRes = await fetch(sectionsUrl)
  if (!sectRes.ok) return null
  const sectData = await sectRes.json()
  const sections = sectData.parse?.sections ?? []

  // Find filming/production section
  const filmingKeywords = lang === 'fr'
    ? ['tournage', 'lieux de tournage', 'production', 'lieux']
    : ['filming', 'filming locations', 'production', 'principal photography', 'locations']

  const section = sections.find((s: { line: string }) =>
    filmingKeywords.some(kw => s.line.toLowerCase().includes(kw))
  )
  if (!section) return null

  // Get section content as plain text
  const contentUrl = `https://${lang}.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&section=${section.index}&prop=text&format=json&origin=*`
  const contentRes = await fetch(contentUrl)
  if (!contentRes.ok) return null
  const contentData = await contentRes.json()
  const html = contentData.parse?.text?.['*'] ?? ''

  // Strip HTML to plain text
  const div = document.createElement('div')
  div.innerHTML = html
  // Remove references, edit links, etc.
  div.querySelectorAll('.reference, .mw-editsection, sup, .noprint, style, script').forEach(el => el.remove())
  const text = div.textContent?.trim() ?? ''

  // Skip if too short or just a heading
  if (text.length < 50) return null
  // Cap at reasonable length
  return text.length > 2000 ? text.slice(0, 2000) + '…' : text
}

const LocationMap = lazy(() => import('./FilmingLocationsMap'))

interface Props {
  imdbId: string | null
}

export function FilmingLocations({ imdbId }: Props) {
  const [locations, setLocations] = useState<FilmingLocation[]>([])
  const [wikiText, setWikiText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!imdbId) { setLoading(false); return }
    let cancelled = false

    // Fetch locations and wiki text independently
    fetchFilmingLocations(imdbId)
      .then(locs => { if (!cancelled) setLocations(locs) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    fetchWikipediaFilmingSection(imdbId)
      .then(wiki => { if (!cancelled) setWikiText(wiki) })
      .catch(() => {})

    return () => { cancelled = true }
  }, [imdbId])

  // Show button only if we have locations OR wiki text
  if (loading || (locations.length === 0 && !wikiText)) return null

  const filmingLocs = locations.filter(l => l.type === 'filming')
  const narrativeLocs = locations.filter(l => l.type === 'narrative')
  // Only show narrative locs that aren't also filming locs
  const filmingNames = new Set(filmingLocs.map(l => l.name))
  const uniqueNarrativeLocs = narrativeLocs.filter(l => !filmingNames.has(l.name))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        🗺️
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md sm:mx-4 bg-[var(--color-surface)] sm:rounded-2xl rounded-t-2xl border-t sm:border border-[var(--color-border)] max-h-[80dvh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-[var(--color-text)]">📍 Lieux de tournage</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Map */}
              {locations.length > 0 && (
                <div className="min-h-[300px] relative">
                  <Suspense fallback={
                    <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                      Chargement de la carte...
                    </div>
                  }>
                    <LocationMap locations={locations} />
                  </Suspense>
                </div>
              )}

              {/* Filming locations list */}
              {filmingLocs.length > 0 && (
                <div className="px-4 py-3 space-y-2 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    🎬 Tourné à ({filmingLocs.length})
                  </p>
                  {filmingLocs.map((loc, i) => (
                    <div key={`f-${i}`} className="flex items-center gap-3">
                      {loc.image ? (
                        <img
                          src={loc.image}
                          alt={loc.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-[var(--color-surface-2)]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-lg flex-shrink-0">📌</div>
                      )}
                      <span className="text-sm text-[var(--color-text)]">{loc.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Narrative locations */}
              {uniqueNarrativeLocs.length > 0 && (
                <div className="px-4 py-3 space-y-2 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
                    🎭 L'action se déroule à ({uniqueNarrativeLocs.length})
                  </p>
                  {uniqueNarrativeLocs.map((loc, i) => (
                    <div key={`n-${i}`} className="flex items-center gap-3">
                      {loc.image ? (
                        <img
                          src={loc.image}
                          alt={loc.name}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-[var(--color-surface-2)]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-lg flex-shrink-0">🎭</div>
                      )}
                      <span className="text-sm text-[var(--color-text)]">{loc.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Wikipedia filming section */}
              {wikiText && (
                <div className="px-4 py-3 border-t border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium mb-2">
                    📖 Détails du tournage
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line">
                    {wikiText}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] opacity-50 mt-2">
                    Source : Wikipédia
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export type { FilmingLocation }
