import { supabase } from './supabase'
import type { TmdbTvShow, TmdbTvShowDetail } from './tmdb'

/**
 * Upsert une série TMDB dans la table tv_shows locale et retourne son UUID.
 * Utilise tmdb_id comme clé de déduplication.
 */
export async function ensureTvShow(show: TmdbTvShow | TmdbTvShowDetail): Promise<string> {
  const genres = 'genres' in show && Array.isArray(show.genres)
    ? (show.genres as { id: number; name: string }[]).map(g => g.name)
    : []

  const payload = {
    tmdb_id: show.id,
    name: show.name,
    original_name: show.original_name,
    overview: show.overview ?? '',
    poster_path: show.poster_path ?? null,
    backdrop_path: show.backdrop_path ?? null,
    first_air_date: show.first_air_date || null,
    vote_average: show.vote_average ?? null,
    genres,
    number_of_seasons: 'number_of_seasons' in show ? (show.number_of_seasons ?? null) : null,
    status: 'status' in show ? (show.status ?? null) : null,
  }

  const { data, error } = await supabase
    .from('tv_shows')
    .upsert(payload, { onConflict: 'tmdb_id' })
    .select('id')
    .single()

  if (error) throw new Error(`Impossible d'enregistrer la série : ${error.message}`)
  return data.id as string
}
