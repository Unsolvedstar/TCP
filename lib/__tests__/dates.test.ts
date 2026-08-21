/// <reference types="jest" />
import { toLocalISODate, formatShortDate } from '../dates'

describe('toLocalISODate', () => {
  it('formats year-month-day with zero-padding', () => {
    expect(toLocalISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('does not shift the date the way toISOString() would in a positive UTC offset', () => {
    // A local midnight in e.g. UTC+2 becomes the previous day in UTC — this
    // is exactly the bug toLocalISODate exists to avoid.
    const localMidnight = new Date(2026, 5, 15, 0, 0, 0)
    expect(toLocalISODate(localMidnight)).toBe('2026-06-15')
  })

  it('pads single-digit months and days', () => {
    expect(toLocalISODate(new Date(2026, 8, 9))).toBe('2026-09-09')
  })

  it('handles December correctly', () => {
    expect(toLocalISODate(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('formatShortDate', () => {
  it('formats as "DD Mon"', () => {
    expect(formatShortDate('2026-02-18')).toBe('18 Feb')
  })

  it('zero-pads the day', () => {
    expect(formatShortDate('2026-03-05')).toBe('05 Mar')
  })
})
