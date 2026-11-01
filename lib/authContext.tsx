import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
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

  // What `last_active_at` was before THIS visit stamped it. lib/membershipCheckIn.ts decides whether
  // to ask "are you still part of the parish?" from the person's previous activity; if we let a later
  // re-fetch (the portal re-fetches on focus) pick up the fresh stamp, the question could never show.
  const priorActive = useRef<{ id: string; at: string | null } | null>(null)

  const loadProfile = useCallback(async (userId: string, email?: string | null) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    const isHardcodedAdmin = email?.toLowerCase() === HARDCODED_ADMIN_EMAIL
    let loaded = (data as Profile) ?? null
    if (loaded) {
      if (priorActive.current?.id !== loaded.id) priorActive.current = { id: loaded.id, at: loaded.last_active_at }
      loaded = { ...loaded, last_active_at: priorActive.current.at }
    }
    setProfile(loaded && isHardcodedAdmin ? { ...loaded, role: 'admin' } : loaded)
  }, [])

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

  // These two must keep the same identity between renders. Screens put refreshProfile in the
  // dependency list of their focus-effect loaders; a new function every render made that effect
  // re-run, re-fetch the profile, re-render the provider, and so on forever — a continuous
  // stream of requests that made the whole app twitch.
  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id, session.user.email)
  }, [session, loadProfile])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Sign out failed', err)
    }
  }, [])

  const value = useMemo(() => ({ session, profile, loading, refreshProfile, signOut }), [session, profile, loading, refreshProfile, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
