// Types générés depuis le schéma Supabase
// Régénérez avec : npx supabase gen types typescript --project-id <id> > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string
          avatar_url: string | null
          partner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name: string
          avatar_url?: string | null
          partner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string
          avatar_url?: string | null
          partner_id?: string | null
          updated_at?: string
        }
      }
      movies: {
        Row: {
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
          created_at: string
        }
        Insert: {
          id?: string
          tmdb_id: number
          title: string
          original_title: string
          overview: string
          poster_path?: string | null
          backdrop_path?: string | null
          release_date?: string | null
          vote_average?: number | null
          genres?: string[]
          runtime?: number | null
          created_at?: string
        }
        Update: {
          title?: string
          overview?: string
          poster_path?: string | null
          backdrop_path?: string | null
          vote_average?: number | null
          genres?: string[]
          runtime?: number | null
        }
      }
      watchlist: {
        Row: {
          id: string
          movie_id: string
          added_by: string
          couple_id: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          movie_id: string
          added_by: string
          couple_id: string
          note?: string | null
          created_at?: string
        }
        Update: {
          note?: string | null
        }
      }
      collection: {
        Row: {
          id: string
          movie_id: string
          couple_id: string
          watched_at: string
          rating_user1: number | null
          rating_user2: number | null
          note_user1: string | null
          note_user2: string | null
          created_at: string
        }
        Insert: {
          id?: string
          movie_id: string
          couple_id: string
          watched_at?: string
          rating_user1?: number | null
          rating_user2?: number | null
          note_user1?: string | null
          note_user2?: string | null
          created_at?: string
        }
        Update: {
          watched_at?: string
          rating_user1?: number | null
          rating_user2?: number | null
          note_user1?: string | null
          note_user2?: string | null
        }
      }
      couples: {
        Row: {
          id: string
          user1_id: string
          user2_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user1_id: string
          user2_id: string
          created_at?: string
        }
        Update: Record<string, never>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Types utilitaires
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Movie = Database['public']['Tables']['movies']['Row']
export type WatchlistEntry = Database['public']['Tables']['watchlist']['Row']
export type CollectionEntry = Database['public']['Tables']['collection']['Row']
export type Couple = Database['public']['Tables']['couples']['Row']

// Types amis (non générés — table friendships)
export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

// Types recommandations (non générés — table recommendations)
export interface Recommendation {
  id: string
  from_user_id: string
  to_user_id: string
  movie_id: number | null
  tv_show_id: number | null
  message: string | null
  created_at: string
  seen_at: string | null
}
