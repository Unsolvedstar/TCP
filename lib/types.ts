export type Gender = 'Male' | 'Female'

export type AppRole = 'member' | 'admin'

// Wards and leagues are per-congregation data now, not a fixed global list —
// see lib/congregation-context.tsx. WardRow/LeagueRow are what the app reads;
// Profile/Dependent only ever store the id.
export type WardRow = { id: string; name: string; color: string; bank_code: number }
export type LeagueRow = { id: string; key: string; label: string; info: string | null; color: string; has_badge: boolean }

export type BaptismApplication = { type: string | null; sponsor_name: string | null; note?: string | null; signature: string | null; signed_at: string }
export type ConfirmationApplication = {
  mentor_name: string | null
  note?: string | null
  signature: string | null
  signed_at: string
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
}

export type WardStat = { ward_id: string; cnt: number }
export type GenderStat = { gender: string; cnt: number }
export type LeagueStat = { league_id: string | null; cnt: number }
export type SacramentStat = { total: number; baptised: number; confirmed: number; adults: number; children: number }
export type Birthday = { full_name: string; date_of_birth: string; is_child: boolean; ward_id: string; next_birthday: string }
