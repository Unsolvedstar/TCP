/// <reference types="jest" />
import { shouldShowMembershipCheckIn } from '../membership-check-in'
import type { Profile } from '../types'

const NOW = new Date('2026-08-21T12:00:00Z')

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function baseProfile(overrides: Partial<Profile>): Profile {
  return {
    id: 'p1',
    full_name: 'Test Person',
    phone: null,
    date_of_birth: null,
    gender: null,
    congregation_id: 'c1',
    ward_id: 'w1',
    role: 'member',
    league_id: null,
    baptised: false,
    confirmed: false,
    pending_league_id: null,
    pending_baptism: false,
    pending_confirmation: false,
    baptism_application: null,
    confirmation_application: null,
    league_application: null,
    reviewed_at: null,
    last_active_at: null,
    membership_confirmed_at: null,
    self_reported_left_at: null,
    created_at: daysBefore(1000),
    ...overrides,
  }
}

describe('shouldShowMembershipCheckIn', () => {
  it('is due for someone who has never confirmed and has no recent activity', () => {
    const p = baseProfile({ last_active_at: daysBefore(200) })
    expect(shouldShowMembershipCheckIn(p, NOW)).toBe(true)
  })

  it('is not due within a year of the last confirmation', () => {
    const p = baseProfile({ membership_confirmed_at: daysBefore(200), last_active_at: daysBefore(200) })
    expect(shouldShowMembershipCheckIn(p, NOW)).toBe(false)
  })

  it('is due again more than a year after the last confirmation', () => {
    const p = baseProfile({ membership_confirmed_at: daysBefore(400), last_active_at: daysBefore(400) })
    expect(shouldShowMembershipCheckIn(p, NOW)).toBe(true)
  })

  it('is skipped for someone who was active recently, even if otherwise due', () => {
    const p = baseProfile({ membership_confirmed_at: daysBefore(400), last_active_at: daysBefore(10) })
    expect(shouldShowMembershipCheckIn(p, NOW)).toBe(false)
  })

  it('is not due right after someone self-reports as having left', () => {
    const p = baseProfile({ self_reported_left_at: daysBefore(5), last_active_at: daysBefore(5) })
    expect(shouldShowMembershipCheckIn(p, NOW)).toBe(false)
  })

  it('uses whichever response (confirm or self-report) is more recent', () => {
    const p = baseProfile({ membership_confirmed_at: daysBefore(400), self_reported_left_at: daysBefore(10), last_active_at: daysBefore(500) })
    expect(shouldShowMembershipCheckIn(p, NOW)).toBe(false)
  })

  it('is due a year after a self-report if they never respond again', () => {
    const p = baseProfile({ self_reported_left_at: daysBefore(400), last_active_at: daysBefore(400) })
    expect(shouldShowMembershipCheckIn(p, NOW)).toBe(true)
  })
})
