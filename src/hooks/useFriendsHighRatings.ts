import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface HighRatingRow {
  tmdb_id: number
  media_type: 'movie' | 'tv'
  friend_name: string
  rating: number
}

/** Map "media_type-tmdb_id" → list of friend display_names who rated ≥ 4 stars */
export function useFriendsHighRatings(userId: string | null) {
  const [ratingMap, setRatingMap] = useState<Map<string, string[]>>(new Map())

  const fetch = useCallback(async () => {
    if (!userId) {
      setRatingMap(new Map())
      return
    }

    const { data, error } = await supabase.rpc('get_friends_high_ratings')

    if (error || !data) return

    const rows = data as unknown as HighRatingRow[]
    const map = new Map<string, string[]>()
    for (const row of rows) {
      const key = `${row.media_type ?? 'movie'}-${row.tmdb_id}`
      const existing = map.get(key) ?? []
      if (!existing.includes(row.friend_name)) {
        existing.push(row.friend_name)
        map.set(key, existing)
      }
    }
    setRatingMap(map)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { ratingMap, refetch: fetch }
}
