/**
 * Formats a Date as a local-timezone ISO date string (YYYY-MM-DD).
 *
 * `Date.toISOString()` converts to UTC first, which silently shifts the date
 * by a day for anyone in a positive UTC offset — including South Africa
 * (UTC+2), this app's actual audience. A local midnight pick would come out
 * as the day before. Every "get the ISO date for this local Date" call in
 * the app should go through this instead.
 */
export function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Compact "18 Feb" style formatting, for date ranges where a full long date would wrap. */
export function formatShortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}
