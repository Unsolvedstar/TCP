import type { AgeGroup } from './age-groups'

export type Gender = 'Male' | 'Female'

export type AppRole = 'member' | 'admin'

// Wards and leagues are per-congregation data now, not a fixed global list —
// see lib/congregation-context.tsx. WardRow/LeagueRow are what the app reads;
// Profile/Dependent only ever store the id.
export type WardRow = { id: string; name: string; color: string; bank_code: number }
export type LeagueRow = { id: string; key: string; label: string; info: string | null; color: string; has_badge: boolean }

export type BaptismApplication = {
  type: string | null
  sponsor_name: string | null
  note?: string | null
  location?: string | null
  officiant_name?: string | null
  signature: string | null
  signed_at: string
}
export type ConfirmationApplication = {
  mentor_name: string | null
  note?: string | null
  location?: string | null
  officiant_name?: string | null
  signature: string | null
  signed_at: string
  // Only ever present on rows created via the post-registration portal
  // request flow (components/portal-involvement-card.tsx), which still
  // requires certificate uploads — registration itself no longer collects one.
  baptism_certificate?: string | null
}
export type LeagueApplication = {
  reason: string | null
  signature: string | null
  signed_at: string
  baptism_certificate?: string | null
  confirmation_certificate?: string | null
}

export type Profile = {
  id: string
  full_name: string
  phone: string | null
  date_of_birth: string | null
  gender: Gender | null
  congregation_id: string
  ward_id: string
  role: AppRole
  league_id: string | null
  baptised: boolean
  confirmed: boolean
  pending_league_id: string | null
  pending_baptism: boolean
  pending_confirmation: boolean
  baptism_application: BaptismApplication | null
  confirmation_application: ConfirmationApplication | null
  league_application: LeagueApplication | null
  reviewed_at: string | null
  last_active_at: string | null
  membership_confirmed_at: string | null
  self_reported_left_at: string | null
  created_at: string
}

export type Dependent = {
  id: string
  guardian_id: string
  full_name: string
  date_of_birth: string | null
  gender: Gender | null
  ward_id: string
  league_id: string | null
  baptised: boolean
  confirmed: boolean
  pending_league_id: string | null
  pending_baptism: boolean
  pending_confirmation: boolean
  baptism_application: BaptismApplication | null
  confirmation_application: ConfirmationApplication | null
  league_application: LeagueApplication | null
  reviewed_at: string | null
  created_at: string
}

export type ChildRow = Dependent & { guardian: { full_name: string } | null }

export type Announcement = {
  id: string
  title: string
  date_text: string
  body: string
  created_at: string
  created_by: string | null
  league_id?: string | null
  poster?: string | null
}

export type ChurchEventRow = {
  id: string
  congregation_id: string
  league_id: string | null
  title: string
  event_date: string
  end_date: string | null
  description: string | null
  created_at: string
  created_by: string | null
  source?: string
}

export type CeremonyKind = 'baptism' | 'confirmation' | 'league'

export type CeremonyProposal = {
  id: string
  congregation_id: string
  subject_profile_id: string | null
  subject_dependent_id: string | null
  kind: CeremonyKind
  league_id: string | null
  ceremony_date: string
  status: 'proposed' | 'confirmed' | 'declined'
  proposed_by: string | null
  responded_at: string | null
  created_at: string
}

export type WardStat = { ward_id: string; cnt: number }
export type GenderStat = { gender: string; cnt: number }
export type LeagueStat = { league_id: string | null; cnt: number }
export type SacramentStat = { total: number; baptised: number; confirmed: number; adults: number; children: number; elders: number }
export type Birthday = { full_name: string; date_of_birth: string; age_group: AgeGroup | null; ward_id: string; next_birthday: string }
