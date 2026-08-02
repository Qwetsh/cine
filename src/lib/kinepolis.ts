// API publique Kinepolis (celle utilisée par kinepolis.fr, CORS ouvert)
const PROGRAMMATION_URL = 'https://kinepolisweb-programmation.kinepolis.com/api/Programmation/FR/FR/WWW/Cinema/KinepolisFrance'

export interface KinepolisFilm {
  title: string
  corporateId: number
  id: string // code Vista "HO000..."
  imdbCode: string | null
  releaseDate: string
}

interface ProgrammationResponse {
  films: KinepolisFilm[]
}

// Cache en mémoire pour la durée de la session (la programmation change au plus une fois par jour)
let cache: Promise<KinepolisFilm[]> | null = null

function fetchFilms(): Promise<KinepolisFilm[]> {
  if (!cache) {
    cache = fetch(PROGRAMMATION_URL)
      .then(r => {
        if (!r.ok) throw new Error(`Kinepolis API ${r.status}`)
        return r.json() as Promise<ProgrammationResponse>
      })
      .then(data => data.films ?? [])
      .catch(err => {
        cache = null // permettre une nouvelle tentative
        throw err
      })
  }
  return cache
}

// Normalisation pour le matching par titre (accents, ponctuation, casse)
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugify(s: string): string {
  return normalize(s).replace(/ /g, '-')
}

/**
 * Retrouve un film dans la programmation Kinepolis, par ID IMDb (fiable)
 * ou par titre normalisé en secours. Renvoie null s'il n'est pas à l'affiche.
 */
export async function findKinepolisFilm(opts: {
  imdbId?: string | null
  title?: string
  originalTitle?: string
}): Promise<KinepolisFilm | null> {
  try {
    const films = await fetchFilms()
    if (opts.imdbId) {
      const byImdb = films.find(f => f.imdbCode === opts.imdbId)
      if (byImdb) return byImdb
    }
    for (const t of [opts.title, opts.originalTitle]) {
      if (!t) continue
      const n = normalize(t)
      const byTitle = films.find(f => normalize(f.title) === n)
      if (byTitle) return byTitle
    }
    return null
  } catch {
    return null
  }
}

/**
 * URL de la fiche film sur kinepolis.fr. Le slug est purement cosmétique
 * (seuls corporateId et le code HO comptent) ; `complex` présélectionne le cinéma.
 */
export function getKinepolisFilmUrl(film: KinepolisFilm, complex?: string): string {
  const base = `https://kinepolis.fr/movies/detail/${film.corporateId}/${film.id}/0/${slugify(film.title)}/`
  return complex ? `${base}?complex=${complex}` : base
}

/** URL de la programmation d'un cinéma (fallback quand le film n'est pas trouvé). */
export function getKinepolisOverviewUrl(complex: string): string {
  return `https://kinepolis.fr/movies/overview/?complex=${complex}`
}
