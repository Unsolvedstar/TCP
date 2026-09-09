import type { AgeGroup } from './ageGroups'

export type Gender = 'Male' | 'Female'

export type AppRole = 'member' | 'admin'

// Wards and leagues are per-congregation data now, not a fixed global list —
// see lib/congregationContext.tsx. WardRow/LeagueRow are what the app reads;
// Profile/Dependent only ever store the id.
export type WardRow = { id: string; name: string; color: string; bank_code: number }

// Full congregation row, including Phase 2 branding/banking fields — see
// supabase/migrations/0023_congregation_branding_banking.sql. `slug` is only
// present on the pre-auth directory/lookup shapes (CongregationSummary),
// never fetched post-login since a signed-in user's own congregation_id is
// already known.
export type CongregationRow = {
  id: string
  name: string
  address: string | null
  domain: string | null
  tagline: string | null
  logo_url: string | null
  primary_color: string
  accent_color: string | null
  snapscan_qr_url: string | null
}

// Returned by the pre-auth list_congregations()/get_congregation_by_slug()
// RPCs (lib/congregation.ts) — deliberately narrower than CongregationRow,
// since banking details must never be anon-exposed.
export type CongregationSummary = {
  id: string
  name: string
  slug: string
  address: string | null
  tagline: string | null
  logo_url: string | null
  primary_color: string
}

export type BankAccountRow = { id: string; name: string; bank_name: string; account_number: string; branch_code: string; sort_order: number }
export type PaymentCodeRow = { id: string; code: string; label: string; account_id: string; sort_order: number }
export type LeagueRow = {
  id: string
  key: string
  label: string
  info: string | null
  color: string
  has_badge: boolean
  // Installation-certificate signature/verse fields — see
  // supabase/migrations/0022_certificate_details.sql.
  chairperson_name: string | null
  pastor_name: string | null
  verse_reference: string | null
  verse_text: string | null
}

// name is null until someone actually claims the code (registers or joins
// with it) — an admin-generated code starts as an unclaimed, unnamed slot.
export type Household = { id: string; congregation_id: string; name: string | null; code: string; created_at: string }

export type BaptismApplication = {
  type: string | null
  sponsor_name: string | null
  note?: string | null
  location?: string | null
  officiant_name?: string | null
  submitted_at: string
  // Baptism-certificate detail fields, set by an admin via
  // admin_set_baptism_certificate_details (0022_certificate_details.sql) —
  // absent until an admin fills them in, never collected at registration/request time.
  register_no?: string | null
  diocese?: string | null
  parents?: string | null
  birth_place?: string | null
  verse_reference?: string | null
  verse_text?: string | null
}
export type ConfirmationApplication = {
  mentor_name: string | null
  note?: string | null
  location?: string | null
  officiant_name?: string | null
  submitted_at: string
  // Only ever present on rows created via the post-registration portal
  // request flow (components/portalInvolvementCard.tsx), which still
  // requires certificate uploads — registration itself no longer collects one.
  baptism_certificate?: string | null
}
export type LeagueApplication = {
  reason: string | null
  submitted_at: string
  baptism_certificate?: string | null
  confirmation_certificate?: string | null
}

export type Profile = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: Gender | null
  congregation_id: string
  ward_id: string
  household_id: string | null
  role: AppRole
  is_service_account: boolean
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
  profession: string | null
}

// congregation_directory() — only members who've set a profession appear here.
export type DirectoryEntry = { id: string; full_name: string; profession: string; ward_id: string }

export type Dependent = {
  id: string
  guardian_id: string
  full_name: string
  date_of_birth: string | null
  gender: Gender | null
  ward_id: string
  household_id: string | null
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
