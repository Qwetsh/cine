import { useEffect, useState, lazy, Suspense } from 'react'

interface FilmingLocation {
  name: string
  lat: number
  lng: number
  image: string | null
}

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

function buildQuery(imdbId: string): string {
  return `
SELECT DISTINCT ?locationLabel ?lat ?lon ?image WHERE {
  ?film wdt:P345 "${imdbId}" .
  ?film wdt:P915 ?location .
  ?location wdt:P625 ?coord .
  OPTIONAL { ?location wdt:P18 ?image . }
  BIND(geof:latitude(?coord) AS ?lat)
  BIND(geof:longitude(?coord) AS ?lon)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
}
LIMIT 50
`.trim()
}

async function fetchFilmingLocations(imdbId: string): Promise<FilmingLocation[]> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(buildQuery(imdbId))}&format=json`
  const res = await fetch(url, {
    headers: { 'Accept': 'application/sparql-results+json' },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.results.bindings
    .map((b: Record<string, { value: string }>) => {
      const rawImage = b.image?.value ?? null
      let image: string | null = null
      if (rawImage) {
        const url = rawImage.replace('http://', 'https://')
        image = url.includes('Special:FilePath')
          ? `${url}${url.includes('?') ? '&' : '?'}width=400`
          : url
      }
      return {
        name: b.locationLabel?.value ?? 'Lieu inconnu',
        lat: parseFloat(b.lat?.value),
        lng: parseFloat(b.lon?.value),
        image,
      }
    })
    .filter((l: FilmingLocation) => !isNaN(l.lat) && !isNaN(l.lng))
}

const LocationMap = lazy(() => import('./FilmingLocationsMap'))

interface Props {
  imdbId: string | null
}

export function FilmingLocations({ imdbId }: Props) {
  const [locations, setLocations] = useState<FilmingLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!imdbId) { setLoading(false); return }
    let cancelled = false

    fetchFilmingLocations(imdbId)
      .then(result => { if (!cancelled) setLocations(result) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [imdbId])

  if (loading || locations.length === 0) return null

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

            {/* Map */}
            <div className="flex-1 min-h-[300px] relative">
              <Suspense fallback={
                <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                  Chargement de la carte...
                </div>
              }>
                <LocationMap locations={locations} />
              </Suspense>
            </div>

            {/* Location list */}
            <div className="overflow-y-auto max-h-[30vh] px-4 py-3 space-y-2 border-t border-[var(--color-border)]">
              {locations.map((loc, i) => (
                <div key={i} className="flex items-center gap-3">
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
          </div>
        </div>
      )}
    </>
  )
}

export type { FilmingLocation }
