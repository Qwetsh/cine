import { supabase } from './supabase'
import type { TmdbMovie, TmdbMovieDetail } from './tmdb'

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
