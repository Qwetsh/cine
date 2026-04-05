const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p'

const apiKey = import.meta.env.VITE_TMDB_API_KEY

if (!apiKey) {
  console.warn('VITE_TMDB_API_KEY manquant — les recherches de films ne fonctionneront pas.')
}

// Tailles d'images disponibles sur TMDB
export const POSTER_SIZES = {
  small: 'w185',
  medium: 'w342',
  large: 'w500',
  original: 'original',
} as const

export const BACKDROP_SIZES = {
  small: 'w300',
  medium: 'w780',
  large: 'w1280',
  original: 'original',
} as const

export function getPosterUrl(
  posterPath: string | null,
  size: keyof typeof POSTER_SIZES = 'medium'
): string {
  if (!posterPath) return '/placeholder-poster.svg'
  return `${TMDB_IMAGE_BASE_URL}/${POSTER_SIZES[size]}${posterPath}`
}

export function getBackdropUrl(
  backdropPath: string | null,
  size: keyof typeof BACKDROP_SIZES = 'large'
): string {
  if (!backdropPath) return '/placeholder-backdrop.svg'
  return `${TMDB_IMAGE_BASE_URL}/${BACKDROP_SIZES[size]}${backdropPath}`
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'fr-FR')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`TMDB API error ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

// Types TMDB
export interface TmdbMovie {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  popularity: number
  adult: boolean
}

export interface TmdbMovieDetail extends TmdbMovie {
  runtime: number | null
  genres: { id: number; name: string }[]
  tagline: string
  status: string
  budget: number
  revenue: number
  production_countries: { iso_3166_1: string; name: string }[]
  spoken_languages: { iso_639_1: string; name: string }[]
  homepage: string
  imdb_id: string | null
  credits?: {
    cast: TmdbCastMember[]
    crew: TmdbCrewMember[]
  }
}

export interface TmdbCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TmdbCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TmdbSearchResult {
  page: number
  results: TmdbMovie[]
  total_pages: number
  total_results: number
}

export type SearchMode = 'title' | 'actor' | 'director'

export interface TmdbGenre {
  id: number
  name: string
}

export interface TmdbPerson {
  id: number
  name: string
  known_for_department: string
  profile_path: string | null
}

export interface TmdbPersonDetail extends TmdbPerson {
  biography: string
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  also_known_as: string[]
  homepage: string | null
}

export interface TmdbExternalIds {
  imdb_id: string | null
  facebook_id: string | null
  instagram_id: string | null
  twitter_id: string | null
  tiktok_id: string | null
  youtube_id: string | null
  wikidata_id: string | null
}

export interface TmdbPersonSearchResult {
  page: number
  results: TmdbPerson[]
  total_pages: number
  total_results: number
}

export interface WatchProvider {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

export interface WatchProviderCountry {
  link?: string
  flatrate?: WatchProvider[]
  rent?: WatchProvider[]
  buy?: WatchProvider[]
  free?: WatchProvider[]
}

export interface WatchProviderResult {
  id: number
  results: Record<string, WatchProviderCountry>
}

export interface DiscoverParams {
  with_genres?: string
  'primary_release_date.gte'?: string
  'primary_release_date.lte'?: string
  with_cast?: string
  with_crew?: string
  sort_by?: string
  'vote_count.gte'?: string
  page?: number
  watch_region?: string
  with_watch_providers?: string
  with_watch_monetization_types?: string
  with_origin_country?: string
}

export interface SearchFilters {
  mode: SearchMode
  genres: number[]
  yearRange: [number, number] | null
  country: string | null
}

// Common origin countries for film filtering
export const COUNTRIES = [
  { code: 'FR', name: 'France' },
  { code: 'US', name: 'États-Unis' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'JP', name: 'Japon' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'IN', name: 'Inde' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australie' },
  { code: 'BR', name: 'Brésil' },
  { code: 'SE', name: 'Suède' },
  { code: 'DK', name: 'Danemark' },
  { code: 'CN', name: 'Chine' },
  { code: 'RU', name: 'Russie' },
  { code: 'MX', name: 'Mexique' },
  { code: 'AR', name: 'Argentine' },
  { code: 'BE', name: 'Belgique' },
  { code: 'TR', name: 'Turquie' },
] as const

// Fonctions API
export const tmdb = {
  searchMovies: (query: string, page = 1) =>
    tmdbFetch<TmdbSearchResult>('/search/movie', { query, page: String(page) }),

  getMovie: (id: number) =>
    tmdbFetch<TmdbMovieDetail>(`/movie/${id}`, { append_to_response: 'credits' }),

  getPopular: (page = 1) =>
    tmdbFetch<TmdbSearchResult>('/movie/popular', { page: String(page) }),

  getTrending: (timeWindow: 'day' | 'week' = 'week') =>
    tmdbFetch<TmdbSearchResult>(`/trending/movie/${timeWindow}`),

  getNowPlaying: (page = 1) =>
    tmdbFetch<TmdbSearchResult>('/movie/now_playing', { page: String(page) }),

  getTopRated: (page = 1) =>
    tmdbFetch<TmdbSearchResult>('/movie/top_rated', { page: String(page) }),

  getUpcoming: (page = 1) =>
    tmdbFetch<TmdbSearchResult>('/movie/upcoming', { page: String(page), region: 'FR' }),

  getSimilar: (id: number) =>
    tmdbFetch<TmdbSearchResult>(`/movie/${id}/similar`),

  getGenres: () =>
    tmdbFetch<{ genres: TmdbGenre[] }>('/genre/movie/list'),

  searchPerson: (query: string) =>
    tmdbFetch<TmdbPersonSearchResult>('/search/person', { query }),

  getPerson: (id: number) =>
    tmdbFetch<TmdbPersonDetail>(`/person/${id}`),

  getPersonEn: (id: number) =>
    tmdbFetch<TmdbPersonDetail>(`/person/${id}`, { language: 'en-US' }),

  getPersonExternalIds: (id: number) =>
    tmdbFetch<TmdbExternalIds>(`/person/${id}/external_ids`),

  getWatchProviders: (id: number) =>
    tmdbFetch<WatchProviderResult>(`/movie/${id}/watch/providers`),

  discoverMovies: (params: DiscoverParams) => {
    const stringParams: Record<string, string> = {}
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) stringParams[key] = String(value)
    }
    return tmdbFetch<TmdbSearchResult>('/discover/movie', stringParams)
  },
}
