export type { Profile, Movie, WatchlistEntry, CollectionEntry, Couple } from './database'

// Types UI / état local
export interface MovieWithPoster {
  id: string
  tmdb_id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string | null
  vote_average: number | null
  genres: string[]
  runtime: number | null
}

export interface WatchlistMovieEntry {
  id: string
  added_by: string
  note: string | null
  created_at: string
  movie: MovieWithPoster
}

export interface CollectionMovieEntry {
  id: string
  watched_at: string
  rating_user1: number | null
  rating_user2: number | null
  note_user1: string | null
  note_user2: string | null
  movie: MovieWithPoster
}

export interface AuthUser {
  id: string
  email: string
  profile: import('./database').Profile | null
}
