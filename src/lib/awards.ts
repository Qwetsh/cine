const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql'

export interface Award {
  awardLabel: string
  categoryLabel: string | null
  year: string | null
  won: boolean
}

/**
 * Fetch awards for a movie or person from Wikidata using their IMDb ID.
 */
export async function fetchAwards(imdbId: string): Promise<Award[]> {
  // SPARQL: find the Wikidata entity by IMDb ID, then get awards received + nominations
  const query = `
    SELECT ?awardLabel ?categoryLabel ?year ?won WHERE {
      ?item wdt:P345 "${imdbId}" .
      {
        ?item p:P166 ?stmt .
        ?stmt ps:P166 ?award .
        OPTIONAL { ?stmt pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
        OPTIONAL { ?stmt pq:P1686 ?category }
        BIND(true AS ?won)
      } UNION {
        ?item p:P1411 ?stmt .
        ?stmt ps:P1411 ?award .
        OPTIONAL { ?stmt pq:P585 ?date . BIND(YEAR(?date) AS ?year) }
        OPTIONAL { ?stmt pq:P1686 ?category }
        BIND(false AS ?won)
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
    }
    ORDER BY DESC(?won) ?year
  `

  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}&format=json`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/sparql-results+json' },
  })

  if (!res.ok) return []

  const data = await res.json()
  const bindings = data.results?.bindings ?? []

  return bindings.map((b: Record<string, { value: string }>) => ({
    awardLabel: b.awardLabel?.value ?? '',
    categoryLabel: b.categoryLabel?.value ?? null,
    year: b.year?.value ?? null,
    won: b.won?.value === 'true',
  }))
}
