export type AgeGroup = 'child' | 'adult' | 'elder'

// Keep in sync with public.age_group() in supabase/migrations/0011_age_groups.sql —
// 60 is South Africa's Older Persons Act (13 of 2006) definition of an
// "older person", used here as a defensible default rather than an
// arbitrary cutoff.
const CHILD_MAX_AGE = 18
const ELDER_MIN_AGE = 60

function ageInYears(dob: Date, asOf: Date): number {
  let age = asOf.getFullYear() - dob.getFullYear()
  const hadBirthdayThisYear = asOf.getMonth() > dob.getMonth() || (asOf.getMonth() === dob.getMonth() && asOf.getDate() >= dob.getDate())
  if (!hadBirthdayThisYear) age -= 1
  return age
}

/**
 * Classifies someone into an age bracket from their date of birth, computed
 * live against `asOf` (today, by default) — never stored, so someone moves
 * from "child" to "adult" to "elder" automatically as time passes, with no
 * manual re-tagging. Returns null when the birthdate isn't known (it's
 * optional at registration) — being in `profiles` (self-registered) vs
 * `dependents` (guardian-managed) says nothing about age either way.
 */
export function classifyAge(dateOfBirth: string | null, asOf: Date = new Date()): AgeGroup | null {
  if (!dateOfBirth) return null
  const age = ageInYears(new Date(dateOfBirth + 'T00:00:00'), asOf)
  if (age < CHILD_MAX_AGE) return 'child'
  if (age >= ELDER_MIN_AGE) return 'elder'
  return 'adult'
}

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  child: 'Child',
  adult: 'Adult',
  elder: 'Elder',
}
