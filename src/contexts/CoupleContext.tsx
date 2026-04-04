import { createContext, useContext } from 'react'
import { useCouple } from '../hooks/useCouple'
import { useAuth } from './AuthContext'
import type { CoupleState } from '../hooks/useCouple'

const CoupleContext = createContext<CoupleState | null>(null)

export function CoupleProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const coupleState = useCouple(user?.id ?? null)

  return (
    <CoupleContext.Provider value={coupleState}>
      {children}
    </CoupleContext.Provider>
  )
}

export function useCoupleContext() {
  const ctx = useContext(CoupleContext)
  if (!ctx) throw new Error('useCoupleContext doit être utilisé dans CoupleProvider')
  return ctx
}
