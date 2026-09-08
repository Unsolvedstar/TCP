import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { supabase } from './supabase'
import { useAuth } from './authContext'
import type { WardRow, LeagueRow } from './types'

type CongregationDataState = {
  wards: WardRow[]
  leagues: LeagueRow[]
  loading: boolean
  // Re-fetches leagues (and wards) without waiting for the profile/congregation
  // to change — needed after an admin action that writes to the leagues table
  // directly (e.g. league certificate details), since those don't otherwise
  // invalidate this cache.
  refresh: () => Promise<void>
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

  async function load() {
    const [wardsRes, leaguesRes] = await Promise.all([
      supabase.from('wards').select('id,name,color,bank_code').order('name'),
      supabase.from('leagues').select('id,key,label,info,color,has_badge,chairperson_name,pastor_name,verse_reference,verse_text').order('label'),
    ])
    setWards((wardsRes.data as WardRow[]) ?? [])
    setLeagues((leaguesRes.data as LeagueRow[]) ?? [])
  }

  useEffect(() => {
    if (!profile) {
      setWards([])
      setLeagues([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    load().then(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [profile?.congregation_id])

  return (
    <CongregationDataContext.Provider value={{ wards, leagues, loading, refresh: load }}>
      {children}
    </CongregationDataContext.Provider>
  )
}

export function useCongregationData() {
  const ctx = useContext(CongregationDataContext)
  if (!ctx) throw new Error('useCongregationData must be used within CongregationDataProvider')
  return ctx
}
