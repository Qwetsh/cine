import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface WantEntry {
  tmdb_id: number
  media_type: 'movie' | 'tv'
  friend_count: number
}

export function useFriendsWantToWatch(userId: string | null) {
  const [wantMap, setWantMap] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!userId) {
      setWantMap(new Map())
      return
    }
    setLoading(true)

    const { data, error } = await supabase.rpc('get_friends_want_to_watch')

    if (!error && data) {
      const entries = data as unknown as WantEntry[]
      const map = new Map<string, number>()
      for (const e of entries) {
        map.set(`${e.media_type}-${e.tmdb_id}`, e.friend_count)
      }
      setWantMap(map)
    }

    setLoading(false)
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { wantMap, loading, refetch: fetch }
}
