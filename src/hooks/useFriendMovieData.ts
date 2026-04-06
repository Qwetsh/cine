import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface FriendMovieEntry {
  display_name: string
  relation: 'wants_to_watch' | 'watched_couple' | 'watched_solo'
  rating: number | null
  note: string | null
}

export function useFriendMovieData(tmdbId: number | null, mediaType: 'movie' | 'tv') {
  const [entries, setEntries] = useState<FriendMovieEntry[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!tmdbId) {
      setEntries([])
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .rpc('get_friend_movie_data', { p_tmdb_id: tmdbId, p_media_type: mediaType })

    if (!error && data) {
      setEntries(data as unknown as FriendMovieEntry[])
    } else {
      setEntries([])
    }

    setLoading(false)
  }, [tmdbId, mediaType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { entries, loading }
}
