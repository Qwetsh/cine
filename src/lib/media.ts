import type { TmdbMovie, TmdbTvShow } from './tmdb'
import type { MovieWithPoster, TvShowWithPoster } from '../types'

/**
 * Socle de la fusion films/séries : un seul modèle d'affichage (celui des
 * films), les séries y sont normalisées avec media_type: 'tv'.
 */

export type MediaItem = TmdbMovie & { media_type?: 'movie' | 'tv' }

/** Normalise une série TMDB vers la forme film pour un rendu unifié */
export function tvToMovie(show: TmdbTvShow): MediaItem {
  return {
    id: show.id,
    title: show.name,
    original_title: show.original_name,
    overview: show.overview,
    poster_path: show.poster_path,
    backdrop_path: show.backdrop_path,
    release_date: show.first_air_date,
    vote_average: show.vote_average,
    vote_count: show.vote_count,
    genre_ids: show.genre_ids,
    popularity: show.popularity,
    adult: false,
    media_type: 'tv',
  }
}

/** Entrelace films et séries par popularité décroissante */
export function mergeByPopularity(movies: TmdbMovie[], shows: TmdbTvShow[]): MediaItem[] {
  const items: MediaItem[] = [
    ...movies.map(m => ({ ...m, media_type: 'movie' as const })),
    ...shows.map(tvToMovie),
  ]
  return items.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
}

/** Clé composite anti-collision : un film et une série peuvent partager un id TMDB */
export function mediaKey(item: { id: number; media_type?: string }): string {
  return `${item.media_type === 'tv' ? 'tv' : 'movie'}-${item.id}`
}

/** Route de la fiche détail selon le média */
export function detailPath(item: { id: number; media_type?: string }): string {
  return item.media_type === 'tv' ? `/tv/${item.id}` : `/movie/${item.id}`
}

/**
 * Normalise une ligne tv_shows (DB) vers la forme MovieWithPoster
 * pour les listes unifiées (watchlist, collection, filtres locaux).
 */
export function tvShowToPosterMovie(ts: TvShowWithPoster): MovieWithPoster {
  return {
    id: ts.id,
    tmdb_id: ts.tmdb_id,
    title: ts.name,
    original_title: ts.original_name,
    overview: ts.overview,
    poster_path: ts.poster_path,
    backdrop_path: ts.backdrop_path,
    release_date: ts.first_air_date,
    vote_average: ts.vote_average,
    genres: ts.genres,
    runtime: null,
  }
}

/**
 * Correspondance genres TMDB film → série (référentiels différents).
 * Seuls les genres sans équivalent direct sont mappés ; les genres communs
 * (16, 18, 35, 37, 80, 99, 9648, 10751, 10764…) gardent leur id.
 * Les genres film sans aucun équivalent TV (27 Horreur, 53 Thriller,
 * 36 Histoire, 10402 Musique, 10749 Romance…) sont abandonnés côté TV.
 */
const MOVIE_TO_TV_GENRE: Record<number, number> = {
  28: 10759, // Action → Action & Adventure
  12: 10759, // Aventure → Action & Adventure
  878: 10765, // Science-Fiction → Sci-Fi & Fantasy
  14: 10765, // Fantastique → Sci-Fi & Fantasy
  10752: 10768, // Guerre → War & Politics
}

const TV_ONLY_GENRES = new Set([10759, 10762, 10763, 10764, 10765, 10766, 10767, 10768])
const COMMON_GENRES = new Set([16, 18, 35, 37, 80, 99, 9648, 10751])

/**
 * Traduit une liste d'ids de genres film en ids de genres TV.
 * Renvoie [] si aucun genre n'est transposable (→ ne pas interroger discover/tv).
 */
export function movieGenresToTv(ids: number[]): number[] {
  const out = new Set<number>()
  for (const id of ids) {
    if (COMMON_GENRES.has(id) || TV_ONLY_GENRES.has(id)) out.add(id)
    else if (MOVIE_TO_TV_GENRE[id]) out.add(MOVIE_TO_TV_GENRE[id])
  }
  return [...out]
}
