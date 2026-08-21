import { supabase } from './supabase'
import type { WardRow, LeagueRow } from './types'

// Phase 1 hardcodes registration to TCP — there's no congregation picker yet
// (that's Phase 2). The registration screen resolves this slug to a real
// congregation_id via the pre-auth RPCs below, rather than hardcoding a raw
// UUID that would break if the seed data is ever regenerated.
export const CONGREGATION_SLUG = 'tshwane-city-parish'

export async function getRegistrationCongregation() {
  const { data, error } = await supabase.rpc('get_congregation_by_slug', { p_slug: CONGREGATION_SLUG })
  if (error) throw error
  const congregation = data?.[0] as { id: string; name: string; address: string | null; tagline: string | null } | undefined
  if (!congregation) throw new Error(`No congregation found for slug "${CONGREGATION_SLUG}"`)

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
