import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PersonalCollectionEntry, TvPersonalCollectionEntry } from '../types'

export function useFriendCollection(friendId: string | null) {
  const [movies, setMovies] = useState<PersonalCollectionEntry[]>([])
  const [tvShows, setTvShows] = useState<TvPersonalCollectionEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!friendId) {
      setMovies([])
      setTvShows([])
      setLoading(false)
      return
    }
    setLoading(true)

    const [moviesRes, tvRes] = await Promise.all([
      supabase.rpc('get_friend_personal_collection', { p_friend_id: friendId }),
      supabase.rpc('get_friend_tv_personal_collection', { p_friend_id: friendId }),
    ])

    if (!moviesRes.error && moviesRes.data) {
      setMovies(moviesRes.data as unknown as PersonalCollectionEntry[])
    }
    if (!tvRes.error && tvRes.data) {
      setTvShows(tvRes.data as unknown as TvPersonalCollectionEntry[])
    }

    setLoading(false)
  }, [friendId])

  useEffect(() => { fetch() }, [fetch])

  return { movies, tvShows, loading }
}
