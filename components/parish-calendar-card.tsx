import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { Card } from './ui'
import { MonthCalendar, type CalendarMarker } from './month-calendar'
import { styles as statStyles } from './stat-cards.styles'
import { supabase } from '../lib/supabase'
import { getChurchEventsInRange, addDays } from '../lib/church-calendar'
import { toLocalISODate } from '../lib/dates'
import { useCongregationData } from '../lib/congregation-context'
import { colors } from '../theme'
import type { ChurchEventRow } from '../lib/types'

const LITURGICAL_COLOR = '#b08d2b'
const BIRTHDAY_COLOR = '#c1447e'
const CONGREGATION_EVENT_COLOR = colors.g700

type BirthdayMonthRow = { full_name: string; age_group: 'child' | 'adult' | 'elder' | null; day_of_month: number }

/** ISO dates from `startIso` through `endIso ?? startIso`, clamped to [viewStart, viewEnd]. */
function expandToVisibleDays(startIso: string, endIso: string | null, viewStart: string, viewEnd: string): string[] {
  const s = startIso > viewStart ? startIso : viewStart
  const e = (endIso ?? startIso) < viewEnd ? (endIso ?? startIso) : viewEnd
  if (s > e) return []
  const out: string[] = []
  let cur = new Date(s + 'T00:00:00')
  const endDate = new Date(e + 'T00:00:00')
  while (cur <= endDate) {
    out.push(toLocalISODate(cur))
    cur = addDays(cur, 1)
  }
  return out
}

// Module-level, not component state, so it survives the card unmounting —
// this screen's calendar tab only renders ParishCalendarCard while it's the
// active tab, so without this every tab switch re-fetched from scratch and
// showed a blank grid for a beat, even for a month already looked at this
// session. Cleared on a full app reload, which is fine — this is a cache,
// not a source of truth.
const markerCache = new Map<string, CalendarMarker[]>()

export function ParishCalendarCard() {
  const { leagues } = useCongregationData()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const monthStartIso = toLocalISODate(month)
  const monthEndIso = toLocalISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0))

  const [markers, setMarkers] = useState<CalendarMarker[]>(() => markerCache.get(monthStartIso) ?? [])

  useEffect(() => {
    let cancelled = false

    // Show a cached month instantly while quietly refetching in the
    // background, instead of dropping back to a blank grid every time.
    const cached = markerCache.get(monthStartIso)
    if (cached) setMarkers(cached)

    async function load() {
      const liturgical = getChurchEventsInRange(monthStartIso, monthEndIso)
      const liturgicalMarkers: CalendarMarker[] = liturgical.flatMap((e) =>
        expandToVisibleDays(e.date, e.endDate ?? null, monthStartIso, monthEndIso).map((date) => ({
          date,
          kind: 'liturgical' as const,
          label: e.name,
          color: LITURGICAL_COLOR,
          detail: e.note,
        }))
      )

      // A wide-enough padding for a multi-day event that started well before
      // this month to still be caught and correctly clipped to it.
      const queryFrom = toLocalISODate(addDays(month, -60))
      const queryTo = toLocalISODate(addDays(new Date(month.getFullYear(), month.getMonth() + 1, 0), 60))

      const [{ data: bdays }, { data: events }] = await Promise.all([
        supabase.rpc('birthdays_for_month', { p_month_start: monthStartIso }),
        supabase.from('events').select('*').gte('event_date', queryFrom).lte('event_date', queryTo),
      ])
      if (cancelled) return

      const birthdayMarkers: CalendarMarker[] = ((bdays as BirthdayMonthRow[]) ?? []).map((b) => ({
        date: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(b.day_of_month).padStart(2, '0')}`,
        kind: 'birthday' as const,
        label: `${b.full_name}'s birthday`,
        color: BIRTHDAY_COLOR,
        detail: b.age_group === 'child' ? 'Child' : b.age_group === 'elder' ? 'Elder' : undefined,
      }))

      const eventMarkers: CalendarMarker[] = ((events as ChurchEventRow[]) ?? []).flatMap((e) => {
        const league = e.league_id ? leagues.find((l) => l.id === e.league_id) : null
        return expandToVisibleDays(e.event_date, e.end_date, monthStartIso, monthEndIso).map((date) => ({
          date,
          kind: 'event' as const,
          label: league ? `${league.label}: ${e.title}` : e.title,
          color: league?.color ?? CONGREGATION_EVENT_COLOR,
          detail: e.description ?? undefined,
        }))
      })

      const all = [...liturgicalMarkers, ...birthdayMarkers, ...eventMarkers]
      markerCache.set(monthStartIso, all)
      setMarkers(all)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [monthStartIso, monthEndIso, leagues])

  return (
    <Card>
      <Text style={statStyles.cardTitle}>Church Calendar</Text>
      <Text style={statStyles.cardSub}>Observances, birthdays, and events — tap a day for details</Text>
      <MonthCalendar month={month} onMonthChange={setMonth} markers={markers} />
    </Card>
  )
}
