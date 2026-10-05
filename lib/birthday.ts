import { toLocalISODate } from './dates'

// True when `dob` ("YYYY-MM-DD") falls on today's month and day. A 29 February
// birthday is celebrated on 28 February in years that have no 29th.
export function isBirthdayToday(dob: string | null | undefined, now: Date = new Date()): boolean {
  if (!dob) return false
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob)
  if (!m) return false
  const month = Number(m[2])
  const day = Number(m[3])
  const todayMonth = now.getMonth() + 1
  const todayDay = now.getDate()
  if (month === todayMonth && day === todayDay) return true
  const isLeapYear = new Date(now.getFullYear(), 1, 29).getDate() === 29
  return month === 2 && day === 29 && !isLeapYear && todayMonth === 2 && todayDay === 28
}

// Age they are turning today, or null when the year isn't usable.
export function turningAge(dob: string, now: Date = new Date()): number | null {
  const year = Number(dob.slice(0, 4))
  const age = now.getFullYear() - year
  return Number.isFinite(age) && age > 0 && age < 130 ? age : null
}

// One celebration per person per calendar day (local time).
export function birthdayShownKey(profileId: string, now: Date = new Date()): string {
  return `birthday-shown:${profileId}:${toLocalISODate(now)}`
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? ''
}
