export type { Profile, Movie, WatchlistEntry, CollectionEntry, Couple, Friendship, Recommendation } from './database'

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
  emoji_user1: string | null
  emoji_user2: string | null
  movie: MovieWithPoster
}

export interface PersonalCollectionEntry {
  id: string
  watched_at: string
  rating: number | null
  note: string | null
  emoji: string | null
  movie: MovieWithPoster
}

// Types UI séries TV
export interface TvShowWithPoster {
  id: string
  tmdb_id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string | null
  vote_average: number | null
  genres: string[]
  number_of_seasons: number | null
  status: string | null
}

export interface TvWatchlistEntry {
  id: string
  season_number: number
  added_by: string
  note: string | null
  created_at: string
  tv_show: TvShowWithPoster
}

export interface TvCollectionEntry {
  id: string
  created_at: string
  tv_show: TvShowWithPoster
}

export interface TvPersonalCollectionEntry {
  id: string
  watched_at: string
  rating: number | null
  note: string | null
  tv_show: TvShowWithPoster
}

export interface TvEpisodeRatingEntry {
  id: string
  tv_show_id: string
  season_number: number
  episode_number: number
  rating_user1: number | null
  rating_user2: number | null
  note_user1: string | null
  note_user2: string | null
  watched_at: string
}

export interface TvSeasonStatusEntry {
  id: string
  tv_show_id: string
  season_number: number
  couple_id: string | null
  user_id: string | null
  watched_type: 'couple' | 'solo'
}

export interface AuthUser {
  id: string
  email: string
  profile: import('./database').Profile | null
}
