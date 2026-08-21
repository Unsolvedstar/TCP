import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'

type LeagueAdminState = {
  myLeagueIds: string[]
  loading: boolean
}

const LeagueAdminContext = createContext<LeagueAdminState | undefined>(undefined)

// Fetches which leagues (if any) the signed-in member administers. RLS on
// league_admins already scopes "select" to the caller's own rows (plus
// congregation admins seeing everyone's), so no extra filter is needed
// beyond "wait for a profile to exist" — same shape as CongregationDataProvider.
export function LeagueAdminProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth()
  const [myLeagueIds, setMyLeagueIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      setMyLeagueIds([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    supabase
      .from('league_admins')
      .select('league_id')
      .eq('profile_id', profile.id)
      .then(({ data }) => {
        if (cancelled) return
        setMyLeagueIds(((data as { league_id: string }[]) ?? []).map((r) => r.league_id))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  return <LeagueAdminContext.Provider value={{ myLeagueIds, loading }}>{children}</LeagueAdminContext.Provider>
}

export function useLeagueAdmin() {
  const ctx = useContext(LeagueAdminContext)
  if (!ctx) throw new Error('useLeagueAdmin must be used within LeagueAdminProvider')
  return ctx
}
