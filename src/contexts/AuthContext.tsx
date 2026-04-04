import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AuthUser } from '../types'
import type { Session } from '@supabase/supabase-js'

interface AuthContextValue {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email ?? '').finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email ?? '')
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId: string, email: string, retries = 3) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    // Le trigger handle_new_user peut avoir du retard — on retry
    if (!profile && retries > 0) {
      await new Promise(r => setTimeout(r, 500))
      return fetchProfile(userId, email, retries - 1)
    }

    setUser({ id: userId, email, profile })
  }

  async function refreshProfile() {
    if (!session?.user) return
    await fetchProfile(session.user.id, session.user.email ?? '')
  }

  async function signIn(email: string, password: string) {
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      await fetchProfile(data.user.id, data.user.email ?? '')
    }
    return { error }
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (!error && data.session && data.user) {
      setSession(data.session)
      await fetchProfile(data.user.id, data.user.email ?? '')
    }
    return { error }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}
