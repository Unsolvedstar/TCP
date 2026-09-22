import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { supabase } from './supabase'
import { useAuth } from './authContext'
import type { WardRow, LeagueRow, CongregationRow, BankAccountRow, PaymentCodeRow } from './types'

type CongregationDataState = {
  congregation: CongregationRow | null
  wards: WardRow[]
  leagues: LeagueRow[]
  bankAccounts: BankAccountRow[]
  paymentCodes: PaymentCodeRow[]
  loading: boolean
  // Re-fetches everything without waiting for the profile/congregation to
  // change — needed after an admin action that writes to these tables
  // directly (e.g. league certificate details, or the Phase 2 congregation
  // admin screen), since those don't otherwise invalidate this cache.
  refresh: () => Promise<void>
}

const CongregationDataContext = createContext<CongregationDataState | undefined>(undefined)

// Fetches the signed-in user's own congregation (branding/banking included)
// and its wards/leagues once their profile is known, and exposes them to
// every screen that used to read hardcoded constants from theme.ts or
// app/(app)/banking.tsx. RLS on every table here already scopes the query to
// the caller's own congregation_id, so no filter is needed beyond "wait for
// a profile to exist".
export function CongregationDataProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth()
  const [congregation, setCongregation] = useState<CongregationRow | null>(null)
  const [wards, setWards] = useState<WardRow[]>([])
  const [leagues, setLeagues] = useState<LeagueRow[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccountRow[]>([])
  const [paymentCodes, setPaymentCodes] = useState<PaymentCodeRow[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const [congregationRes, wardsRes, leaguesRes, bankAccountsRes, paymentCodesRes] = await Promise.all([
      supabase.from('congregations').select('id,name,address,domain,tagline,logo_url,primary_color,accent_color,snapscan_qr_url,snapscan_merchant_code').single(),
      supabase.from('wards').select('id,name,color,bank_code').order('name'),
      supabase.from('leagues').select('id,key,label,info,color,has_badge,chairperson_name,pastor_name,verse_reference,verse_text').order('label'),
      supabase.from('congregation_bank_accounts').select('id,name,bank_name,account_number,branch_code,sort_order').order('sort_order'),
      supabase.from('congregation_payment_codes').select('id,code,label,account_id,sort_order').order('sort_order'),
    ])
    setCongregation((congregationRes.data as CongregationRow) ?? null)
    setWards((wardsRes.data as WardRow[]) ?? [])
    setLeagues((leaguesRes.data as LeagueRow[]) ?? [])
    setBankAccounts((bankAccountsRes.data as BankAccountRow[]) ?? [])
    setPaymentCodes((paymentCodesRes.data as PaymentCodeRow[]) ?? [])
  }

  useEffect(() => {
    if (!profile) {
      setCongregation(null)
      setWards([])
      setLeagues([])
      setBankAccounts([])
      setPaymentCodes([])
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
    <CongregationDataContext.Provider value={{ congregation, wards, leagues, bankAccounts, paymentCodes, loading, refresh: load }}>
      {children}
    </CongregationDataContext.Provider>
  )
}

export function useCongregationData() {
  const ctx = useContext(CongregationDataContext)
  if (!ctx) throw new Error('useCongregationData must be used within CongregationDataProvider')
  return ctx
}
