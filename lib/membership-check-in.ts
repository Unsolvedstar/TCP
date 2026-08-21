import type { Profile } from './types'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000
const RECENTLY_ACTIVE_MS = 45 * 24 * 60 * 60 * 1000

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null
  return now.getTime() - new Date(iso).getTime()
}

/**
 * Whether to ask "are you still part of the parish?" right now.
 *
 * Due once a year per person, counted from whichever they last answered
 * (a "still here" confirmation or an "I've left" self-report — either one
 * resets the clock, since re-asking someone right after they told you
 * they've left is pointless nagging). Skipped for someone who was already
 * active recently (`profile.last_active_at`, which at render time still
 * holds the *previous* session's timestamp — see lib/auth-context.tsx,
 * which stamps activity without refetching the profile) — asking a clearly
 * regular user "are you still here?" is closer to an insult than a check-in.
 */
export function shouldShowMembershipCheckIn(profile: Profile, now: Date = new Date()): boolean {
  const lastResponded = [profile.membership_confirmed_at, profile.self_reported_left_at]
    .filter((v): v is string => v !== null)
    .sort()
    .pop()
  const dueMs = daysAgo(lastResponded ?? null, now)
  const due = dueMs === null || dueMs > YEAR_MS

  const activeMs = daysAgo(profile.last_active_at, now)
  const recentlyActive = activeMs !== null && activeMs < RECENTLY_ACTIVE_MS

  return due && !recentlyActive
}
