import { useMemo } from 'react'
import { addDays, computeAdventSunday, computeEasterSunday } from './church-calendar'
import { toLocalISODate } from './dates'
import { liturgicalPalette } from '../theme'

export type LiturgicalSeason = {
  name: string
  color: string
  text: string
}

/**
 * The Western liturgical colour for a given date — used to tint hero banners
 * across the app so the interface visibly moves through the church year
 * (purple for Lent/Advent, red for Pentecost/Reformation, gold for the festal
 * seasons, green the rest of the time), the way paraments on the altar would.
 * This is a display accent only — it never replaces the parish's green brand
 * identity in the logo, nav, or body chrome.
 */
export function getLiturgicalSeason(date: Date): LiturgicalSeason {
  const year = date.getFullYear()
  const iso = toLocalISODate(date)

  const easter = computeEasterSunday(year)
  const ashWednesday = addDays(easter, -46)
  const palmSunday = addDays(easter, -7)
  const maundyThursday = addDays(easter, -3)
  const goodFriday = addDays(easter, -2)
  const pentecost = addDays(easter, 49)
  const adventSunday = computeAdventSunday(year)
  const christmasEve = new Date(year, 11, 24)
  const christmasStart = new Date(year, 11, 25)
  // Boundary years: early January can still be inside the Christmas season
  // that began the previous December.
  const prevChristmasStart = new Date(year - 1, 11, 25)
  const twelfthNight = new Date(year, 0, 5)

  const on = (d: Date) => iso === toLocalISODate(d)
  const between = (start: Date, end: Date) => iso >= toLocalISODate(start) && iso <= toLocalISODate(end)

  if (between(prevChristmasStart, twelfthNight) || between(christmasStart, new Date(year, 11, 31))) {
    return { name: 'Christmastide', ...liturgicalPalette.christmas }
  }
  if (between(adventSunday, christmasEve)) return { name: 'Advent', ...liturgicalPalette.advent }
  if (on(goodFriday)) return { name: 'Good Friday', ...liturgicalPalette.goodFriday }
  if (on(maundyThursday)) return { name: 'Maundy Thursday', ...liturgicalPalette.maundyThursday }
  if (between(palmSunday, addDays(goodFriday, -1))) return { name: 'Holy Week', ...liturgicalPalette.holyWeek }
  if (between(ashWednesday, addDays(palmSunday, -1))) return { name: 'Lent', ...liturgicalPalette.lent }
  if (between(easter, addDays(pentecost, -1))) return { name: 'Eastertide', ...liturgicalPalette.eastertide }
  if (on(pentecost)) return { name: 'Pentecost', ...liturgicalPalette.pentecost }
  if (on(new Date(year, 9, 31))) return { name: 'Reformation Day', ...liturgicalPalette.reformation }
  if (on(new Date(year, 10, 1))) return { name: "All Saints' Day", ...liturgicalPalette.allSaints }

  return { name: 'Season after Pentecost', ...liturgicalPalette.ordinary }
}

/** Stable for the lifetime of the screen — the season doesn't need to be re-derived on every render. */
export function useLiturgicalSeason(): LiturgicalSeason {
  return useMemo(() => getLiturgicalSeason(new Date()), [])
}
