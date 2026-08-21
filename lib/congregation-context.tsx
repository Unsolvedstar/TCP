import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'
import type { WardRow, LeagueRow } from './types'

type CongregationDataState = {
  wards: WardRow[]
  leagues: LeagueRow[]
  loading: boolean
}

const CongregationDataContext = createContext<CongregationDataState | undefined>(undefined)

// Fetches the signed-in user's own congregation's wards/leagues once their
// profile is known, and exposes them to every screen that used to read the
// hardcoded `wards`/`leagues` constants from theme.ts. RLS on both tables
// already scopes the query to the caller's own congregation_id, so no filter
// is needed here beyond "wait for a profile to exist".
export function CongregationDataProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth()
  const [wards, setWards] = useState<WardRow[]>([])
  const [leagues, setLeagues] = useState<LeagueRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      setWards([])
      setLeagues([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('wards').select('id,name,color,bank_code').order('name'),
      supabase.from('leagues').select('id,key,label,info,color,has_badge').order('label'),
    ]).then(([wardsRes, leaguesRes]) => {
      if (cancelled) return
      setWards((wardsRes.data as WardRow[]) ?? [])
      setLeagues((leaguesRes.data as LeagueRow[]) ?? [])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.congregation_id])

  return (
    <CongregationDataContext.Provider value={{ wards, leagues, loading }}>
      {children}
    </CongregationDataContext.Provider>
  )
}

export function useCongregationData() {
  const ctx = useContext(CongregationDataContext)
  if (!ctx) throw new Error('useCongregationData must be used within CongregationDataProvider')
  return ctx
}
