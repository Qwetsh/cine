import { createContext, useContext, useMemo } from 'react'
import { useFriends } from '../hooks/useFriends'
import { useFriendRecos } from '../hooks/useFriendRecos'
import { useAuth } from './AuthContext'
import type { UseFriendsState } from '../hooks/useFriends'
import type { UseFriendRecosState } from '../hooks/useFriendRecos'

interface FriendsContextValue extends UseFriendsState {
  recos: UseFriendRecosState
}

const FriendsContext = createContext<FriendsContextValue | null>(null)

export function FriendsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const friendsState = useFriends(user?.id ?? null)
  const recosState = useFriendRecos(user?.id ?? null)

  const value = useMemo<FriendsContextValue>(() => ({
    ...friendsState,
    recos: recosState,
  }), [friendsState, recosState])

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
