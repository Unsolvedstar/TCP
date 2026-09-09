import { supabase } from './supabase'
import type { CongregationSummary, WardRow, LeagueRow } from './types'

// Historical default for tests/fallback deep-links — no longer used as an
// implicit default anywhere; the registration screen now always asks via
// listRegistrationCongregations()/the picker (Phase 2).
export const CONGREGATION_SLUG = 'tshwane-city-parish'

export async function listRegistrationCongregations() {
  const { data, error } = await supabase.rpc('list_congregations')
  if (error) throw error
  return (data as CongregationSummary[]) ?? []
}

export async function getRegistrationCongregation(slug: string) {
  const { data, error } = await supabase.rpc('get_congregation_by_slug', { p_slug: slug })
  if (error) throw error
  // get_congregation_by_slug doesn't return `slug` itself (the caller already
  // has it) — filled in here so the result still matches CongregationSummary.
  const row = data?.[0] as Omit<CongregationSummary, 'slug'> | undefined
  if (!row) throw new Error(`No congregation found for slug "${slug}"`)
  const congregation: CongregationSummary = { ...row, slug }

  const [wardsRes, leaguesRes] = await Promise.all([
    supabase.rpc('get_wards_for_congregation', { p_congregation_id: congregation.id }),
    supabase.rpc('get_leagues_for_congregation', { p_congregation_id: congregation.id }),
  ])
  if (wardsRes.error) throw wardsRes.error
  if (leaguesRes.error) throw leaguesRes.error

  return {
    congregation,
    wards: (wardsRes.data as WardRow[]) ?? [],
    leagues: (leaguesRes.data as LeagueRow[]) ?? [],
  }
}
