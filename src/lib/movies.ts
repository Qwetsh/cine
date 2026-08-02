import { supabase } from './supabase'
import type { TmdbMovie, TmdbMovieDetail } from './tmdb'

/**
 * Construit un TmdbMovie « d'affichage » depuis une ligne de la table movies
 * (entrées collection/watchlist). À utiliser avec un movieDbId connu pour que
 * le menu d'appui long n'écrase pas la ligne existante via ensureMovie.
 */
export function posterMovieFromDb(m: {
  tmdb_id: number
  title: string
  original_title?: string | null
  overview?: string | null
  poster_path: string | null
  backdrop_path?: string | null
  release_date?: string | null
  vote_average?: number | null
}): TmdbMovie {
  return {
    id: m.tmdb_id,
    title: m.title,
    original_title: m.original_title ?? m.title,
    overview: m.overview ?? '',
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path ?? null,
    release_date: m.release_date ?? '',
    vote_average: m.vote_average ?? 0,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    adult: false,
  }
}

/**
 * Upsert un film TMDB dans la table movies locale et retourne son UUID.
 * Utilise tmdb_id comme clé de déduplication.
 */
export async function ensureMovie(movie: TmdbMovie | TmdbMovieDetail): Promise<string> {
  const genres = 'genres' in movie && Array.isArray(movie.genres)
    ? (movie.genres as { id: number; name: string }[]).map(g => g.name)
    : []

  const payload = {
    tmdb_id: movie.id,
    title: movie.title,
    original_title: movie.original_title,
    overview: movie.overview ?? '',
    poster_path: movie.poster_path ?? null,
    backdrop_path: movie.backdrop_path ?? null,
    release_date: movie.release_date || null,
    vote_average: movie.vote_average ?? null,
    genres,
    runtime: 'runtime' in movie ? (movie.runtime ?? null) : null,
  }

  const { data, error } = await supabase
    .from('movies')
    .upsert(payload, { onConflict: 'tmdb_id' })
    .select('id')
    .single()

  if (error) throw new Error(`Impossible d'enregistrer le film : ${error.message}`)
  return data.id as string
}
