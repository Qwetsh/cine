import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface FriendRatingEntry {
  tmdb_id: number
  friend_name: string
}

/** Map tmdb_id → list of friend display_names who rated ≥ 4 stars */
export function useFriendsHighRatings(
  friendIds: string[],
  friendProfiles: Map<string, string>,
) {
  const [ratingMap, setRatingMap] = useState<Map<number, string[]>>(new Map())

  const fetch = useCallback(async () => {
    if (friendIds.length === 0) {
      setRatingMap(new Map())
      return
    }

    const { data, error } = await supabase
      .from('personal_collection')
      .select('user_id, rating, movie:movies(tmdb_id)')
      .in('user_id', friendIds)
      .gte('rating', 4)

    if (error || !data) return

    const map = new Map<number, string[]>()
    for (const row of data as unknown as { user_id: string; rating: number; movie: { tmdb_id: number } | null }[]) {
      if (!row.movie) continue
      const tmdbId = row.movie.tmdb_id
      const name = friendProfiles.get(row.user_id) ?? 'Ami'
      const existing = map.get(tmdbId) ?? []
      if (!existing.includes(name)) {
        existing.push(name)
        map.set(tmdbId, existing)
      }
    }
    setRatingMap(map)
  }, [friendIds.join(','), friendProfiles])

  useEffect(() => { fetch() }, [fetch])

  return { ratingMap, refetch: fetch }
}
