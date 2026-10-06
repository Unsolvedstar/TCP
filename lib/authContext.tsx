import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './types'

type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

// This account always gets the admin side, regardless of its profiles.role value.
// (Server-side RLS is covered by migration 0030_hardcoded_admin.sql.)
const HARDCODED_ADMIN_EMAIL = 'tshikovhitshedza9@gmail.com'

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string, email?: string | null) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    const isHardcodedAdmin = email?.toLowerCase() === HARDCODED_ADMIN_EMAIL
    const loaded = (data as Profile) ?? null
    setProfile(loaded && isHardcodedAdmin ? { ...loaded, role: 'admin' } : loaded)
  }

  // Fire-and-forget: records "last active" both for a real sign-in and for
  // opening the app with an already-valid session, since sessions persist
  // for weeks and a sign-in-only signal would rarely reflect real usage.
  function touchLastActive() {
    supabase.rpc('touch_my_last_active').then(({ error }) => {
      if (error) console.error('Failed to record activity', error)
    })
  }

  useEffect(() => {
    // getSession() and loadProfile() must never leave `loading` stuck true —
    // any rejection here (a network hiccup, a cold Supabase project waking up)
    // would otherwise strand the whole app on the loading spinner forever.
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session)
        if (data.session) {
          await loadProfile(data.session.user.id, data.session.user.email)
          touchLastActive()
        }
      })
      .catch((err) => console.error('Failed to load auth session', err))
      .finally(() => setLoading(false))

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      try {
        if (newSession) {
          await loadProfile(newSession.user.id, newSession.user.email)
          touchLastActive()
        } else {
          setProfile(null)
        }
      } catch (err) {
        console.error('Failed to load profile after auth change', err)
      } finally {
        setLoading(false)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  async function refreshProfile() {
    if (session) await loadProfile(session.user.id, session.user.email)
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Sign out failed', err)
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
