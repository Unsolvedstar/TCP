import { toLocalISODate } from './dates'

export type ChurchEvent = {
  name: string
  /** ISO start date (YYYY-MM-DD). The date itself for single-day observances. */
  date: string
  /** ISO end date, present only for season-length entries (e.g. Lent, Advent). */
  endDate?: string
  note?: string
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Western/Gregorian Easter Sunday for a given year (Anonymous Gregorian /
 * Meeus algorithm). ELCSA, like the rest of Western Christianity, follows
 * this reckoning rather than the Orthodox one.
 */
export function computeEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

/** Advent Sunday: the Sunday nearest 30 November (falls between 27 Nov and 3 Dec). */
export function computeAdventSunday(year: number): Date {
  const nov30 = new Date(year, 10, 30)
  const dayOfWeek = nov30.getDay() // 0 = Sunday
  const shift = dayOfWeek <= 3 ? -dayOfWeek : 7 - dayOfWeek
  return addDays(nov30, shift)
}

/** The full set of major Western-church observances for one calendar year. */
export function getChurchEventsForYear(year: number): ChurchEvent[] {
  const easter = computeEasterSunday(year)
  const ashWednesday = addDays(easter, -46)
  const adventSunday = computeAdventSunday(year)

  const events: ChurchEvent[] = [
    { name: 'Epiphany', date: toLocalISODate(new Date(year, 0, 6)), note: 'The visit of the Magi to the infant Christ' },
    { name: 'Ash Wednesday', date: toLocalISODate(ashWednesday), note: 'Lent begins' },
    {
      name: 'Lent',
      date: toLocalISODate(ashWednesday),
      endDate: toLocalISODate(addDays(easter, -1)),
      note: 'A season of prayer, fasting, and repentance leading to Easter',
    },
    { name: 'Palm Sunday', date: toLocalISODate(addDays(easter, -7)), note: "Christ's entry into Jerusalem" },
    { name: 'Maundy Thursday', date: toLocalISODate(addDays(easter, -3)), note: 'The Last Supper' },
    { name: 'Good Friday', date: toLocalISODate(addDays(easter, -2)), note: 'The Crucifixion' },
    { name: 'Easter Sunday', date: toLocalISODate(easter), note: 'The Resurrection of our Lord' },
    {
      name: 'Eastertide',
      date: toLocalISODate(easter),
      endDate: toLocalISODate(addDays(easter, 48)),
      note: 'The fifty days of Easter joy, from Easter to Pentecost',
    },
    { name: 'Ascension Day', date: toLocalISODate(addDays(easter, 39)), note: 'Christ ascends to the Father' },
    { name: 'Pentecost', date: toLocalISODate(addDays(easter, 49)), note: 'The Holy Spirit descends on the Church' },
    { name: 'Trinity Sunday', date: toLocalISODate(addDays(easter, 56)), note: 'Celebrating the Holy Trinity' },
    { name: 'Reformation Day', date: toLocalISODate(new Date(year, 9, 31)), note: "Luther's 95 Theses, 1517" },
    { name: "All Saints' Day", date: toLocalISODate(new Date(year, 10, 1)), note: 'Remembering the faithful departed' },
    { name: 'Advent Sunday', date: toLocalISODate(adventSunday), note: 'Advent begins — preparing for Christmas' },
    {
      name: 'Advent',
      date: toLocalISODate(adventSunday),
      endDate: toLocalISODate(new Date(year, 11, 24)),
      note: 'A season of watchful preparation for the coming of Christ',
    },
    { name: 'Christmas Day', date: toLocalISODate(new Date(year, 11, 25)), note: 'The birth of our Lord' },
  ]

  return events.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Events that are current or still upcoming from `from`, nearest first.
 * Looks across `from`'s year and the next one so the list never runs dry
 * near the end of the year.
 */
export function getUpcomingChurchEvents(from: Date, count: number): ChurchEvent[] {
  const todayIso = toLocalISODate(from)
  const events = [...getChurchEventsForYear(from.getFullYear()), ...getChurchEventsForYear(from.getFullYear() + 1)]
  return events.filter((e) => (e.endDate ?? e.date) >= todayIso).sort((a, b) => a.date.localeCompare(b.date)).slice(0, count)
}
