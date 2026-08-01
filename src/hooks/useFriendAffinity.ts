import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface AffinityCommonItem {
  media_type: 'movie' | 'tv'
  tmdb_id: number
  title: string
  poster_path: string | null
  my_rating: number | null
  friend_rating: number | null
}

export interface AffinityData {
  common_count: number
  my_total: number
  friend_total: number
  /** Moyenne de proximité des notes (0-100), null si aucune œuvre notée en commun */
  affinity_pct: number | null
  rated_common_count: number
  common: AffinityCommonItem[]
}

export function useFriendAffinity(friendUserId: string | null) {
  const [affinity, setAffinity] = useState<AffinityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!friendUserId) {
      setAffinity(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)

    supabase
      .rpc('get_friend_affinity', { p_friend_id: friendUserId })
      .then(({ data, error }) => {
        if (cancelled) return
        if (!error && data) setAffinity(data as unknown as AffinityData)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [friendUserId])

  return { affinity, loading }
}
