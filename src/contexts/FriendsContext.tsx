import { createContext, useCallback, useContext, useMemo } from 'react'
import { useFriends } from '../hooks/useFriends'
import { useFriendRecos } from '../hooks/useFriendRecos'
import { useFriendsWantToWatch } from '../hooks/useFriendsWantToWatch'
import { useFriendsHighRatings } from '../hooks/useFriendsHighRatings'
import { useAuth } from './AuthContext'
import type { UseFriendsState } from '../hooks/useFriends'
import type { UseFriendRecosState } from '../hooks/useFriendRecos'

interface FriendsContextValue extends UseFriendsState {
  recos: UseFriendRecosState
  /** Map "movie-{tmdbId}" or "tv-{tmdbId}" → friend count who want to watch */
  friendsWantMap: Map<string, number>
  getFriendsWantCount: (tmdbId: number, mediaType: 'movie' | 'tv') => number
  /** Get list of friend names who rated this movie ≥ 4 stars */
  getFriendsWhoLoved: (tmdbId: number) => string[]
}

const FriendsContext = createContext<FriendsContextValue | null>(null)

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const friendsState = useFriends(user?.id ?? null)
  const recosState = useFriendRecos(user?.id ?? null)
  const { wantMap } = useFriendsWantToWatch(user?.id ?? null)

  const { ratingMap } = useFriendsHighRatings(user?.id ?? null)

  const getFriendsWantCount = useCallback((tmdbId: number, mediaType: 'movie' | 'tv') => {
    return wantMap.get(`${mediaType}-${tmdbId}`) ?? 0
  }, [wantMap])

  const getFriendsWhoLoved = useCallback((tmdbId: number) => {
    return ratingMap.get(tmdbId) ?? []
  }, [ratingMap])

  const value = useMemo<FriendsContextValue>(() => ({
    ...friendsState,
    recos: recosState,
    friendsWantMap: wantMap,
    getFriendsWantCount,
    getFriendsWhoLoved,
  }), [friendsState, recosState, wantMap, getFriendsWantCount, getFriendsWhoLoved])

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  )
}

export function useFriendsContext() {
  const ctx = useContext(FriendsContext)
  if (!ctx) throw new Error('useFriendsContext doit être utilisé dans FriendsProvider')
  return ctx
}
