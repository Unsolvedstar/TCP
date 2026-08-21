/// <reference types="jest" />
import { computeEasterSunday, computeAdventSunday, getChurchEventsForYear, getUpcomingChurchEvents, addDays } from '../church-calendar'

describe('computeEasterSunday', () => {
  // Known Western/Gregorian Easter Sundays — independently verifiable against
  // any liturgical calendar, not derived from this codebase.
  const knownEaster: Record<number, string> = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28',
  }

  for (const [year, iso] of Object.entries(knownEaster)) {
    it(`is ${iso} for ${year}`, () => {
      const d = computeEasterSunday(Number(year))
      const got = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      expect(got).toBe(iso)
    })
  }
})

describe('computeAdventSunday', () => {
  // Known First Sundays of Advent, independently verifiable.
  const knownAdvent: Record<number, string> = {
    2024: '2024-12-01',
    2025: '2025-11-30',
    2026: '2026-11-29',
    2027: '2027-11-28',
  }

  for (const [year, iso] of Object.entries(knownAdvent)) {
    it(`is ${iso} for ${year}`, () => {
      const d = computeAdventSunday(Number(year))
      const got = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      expect(got).toBe(iso)
    })
  }

  it('always falls on a Sunday', () => {
    for (let year = 2020; year <= 2035; year++) {
      expect(computeAdventSunday(year).getDay()).toBe(0)
    }
  })

  it('always falls between 27 Nov and 3 Dec', () => {
    for (let year = 2020; year <= 2035; year++) {
      const d = computeAdventSunday(year)
      if (d.getMonth() === 10) {
        expect(d.getDate()).toBeGreaterThanOrEqual(27)
      } else {
        expect(d.getMonth()).toBe(11)
        expect(d.getDate()).toBeLessThanOrEqual(3)
      }
    }
  })
})

describe('addDays', () => {
  it('adds positive days', () => {
    expect(addDays(new Date(2026, 0, 1), 10).getDate()).toBe(11)
  })

  it('subtracts with negative days', () => {
    expect(addDays(new Date(2026, 0, 15), -10).getDate()).toBe(5)
  })

  it('rolls over a month boundary', () => {
    const d = addDays(new Date(2026, 0, 30), 5)
    expect(d.getMonth()).toBe(1) // February
    expect(d.getDate()).toBe(4)
  })
})

describe('getChurchEventsForYear', () => {
  it('returns events sorted by date', () => {
    const events = getChurchEventsForYear(2026)
    const dates = events.map((e) => e.date)
    expect(dates).toEqual([...dates].sort((a, b) => a.localeCompare(b)))
  })

  it('derives Good Friday, Easter, and Pentecost from the same Easter anchor', () => {
    const events = getChurchEventsForYear(2026)
    const easter = events.find((e) => e.name === 'Easter Sunday')!
    const goodFriday = events.find((e) => e.name === 'Good Friday')!
    const pentecost = events.find((e) => e.name === 'Pentecost')!
    expect(easter.date).toBe('2026-04-05')
    expect(goodFriday.date).toBe('2026-04-03')
    expect(pentecost.date).toBe('2026-05-24')
  })

  it('includes every expected named observance', () => {
    const names = getChurchEventsForYear(2026).map((e) => e.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'Epiphany',
        'Ash Wednesday',
        'Lent',
        'Palm Sunday',
        'Maundy Thursday',
        'Good Friday',
        'Easter Sunday',
        'Eastertide',
        'Ascension Day',
        'Pentecost',
        'Trinity Sunday',
        'Reformation Day',
        "All Saints' Day",
        'Advent Sunday',
        'Advent',
        'Christmas Day',
      ])
    )
  })
})

describe('getUpcomingChurchEvents', () => {
  it('excludes events that have already passed', () => {
    const from = new Date(2026, 11, 26) // 26 Dec 2026, after Christmas Day
    const upcoming = getUpcomingChurchEvents(from, 5)
    expect(upcoming.every((e) => (e.endDate ?? e.date) >= '2026-12-26')).toBe(true)
  })

  it('spans into the next year near year-end so the list never runs dry', () => {
    const from = new Date(2026, 11, 26)
    const upcoming = getUpcomingChurchEvents(from, 5)
    expect(upcoming.length).toBe(5)
    expect(upcoming.some((e) => e.date.startsWith('2027'))).toBe(true)
  })

  it('respects the requested count', () => {
    const upcoming = getUpcomingChurchEvents(new Date(2026, 0, 1), 3)
    expect(upcoming.length).toBe(3)
  })
})
