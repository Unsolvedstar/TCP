import { useMemo, useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { formatDate, glassBlur } from './ui'
import { styles as uiStyles } from './ui.styles'
import { styles } from './month-calendar.styles'
import { toLocalISODate } from '../lib/dates'

export type CalendarMarker = {
  date: string
  kind: 'liturgical' | 'birthday' | 'event'
  label: string
  color: string
  detail?: string
}

const LEGEND: { kind: CalendarMarker['kind']; label: string; color: string }[] = [
  { kind: 'liturgical', label: 'Church calendar', color: '#b08d2b' },
  { kind: 'birthday', label: 'Birthdays', color: '#c1447e' },
  { kind: 'event', label: 'Events', color: '#2f7a4f' },
]

export function MonthCalendar({
  month,
  onMonthChange,
  markers,
}: {
  month: Date
  onMonthChange: (d: Date) => void
  markers: CalendarMarker[]
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const startWeekday = new Date(year, monthIndex, 1).getDay()

  const cells = useMemo(() => {
    const out: { day: number; iso: string }[] = []
    for (let i = 0; i < startWeekday; i++) out.push({ day: 0, iso: '' })
    for (let d = 1; d <= daysInMonth; d++) out.push({ day: d, iso: toLocalISODate(new Date(year, monthIndex, d)) })
    while (out.length % 7 !== 0) out.push({ day: 0, iso: '' })
    return out
  }, [year, monthIndex, daysInMonth, startWeekday])

  const markersByDate = useMemo(() => {
    const map = new Map<string, CalendarMarker[]>()
    markers.forEach((m) => {
      const arr = map.get(m.date) ?? []
      arr.push(m)
      map.set(m.date, arr)
    })
    return map
  }, [markers])

  const todayIso = toLocalISODate(new Date())
  const monthLabel = month.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
  const selectedMarkers = selectedDate ? (markersByDate.get(selectedDate) ?? []) : []

  return (
    <View>
      <View style={styles.header}>
        <Pressable onPress={() => onMonthChange(new Date(year, monthIndex - 1, 1))} hitSlop={10}>
          <Text style={styles.nav}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <Pressable onPress={() => onMonthChange(new Date(year, monthIndex + 1, 1))} hitSlop={10}>
          <Text style={styles.nav}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell.iso) return <View key={i} style={styles.cell} />
          const dayMarkers = markersByDate.get(cell.iso) ?? []
          const isToday = cell.iso === todayIso
          return (
            <Pressable
              key={i}
              style={[styles.cell, isToday && styles.cellToday]}
              onPress={() => (dayMarkers.length ? setSelectedDate(cell.iso) : undefined)}
            >
              <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{cell.day}</Text>
              {dayMarkers.length ? (
                <View style={styles.dotsRow}>
                  {dayMarkers.slice(0, 3).map((m, idx) => (
                    <View key={idx} style={[styles.dot, { backgroundColor: m.color }]} />
                  ))}
                  {dayMarkers.length > 3 ? <Text style={styles.overflow}>+{dayMarkers.length - 3}</Text> : null}
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>

      <View style={styles.legendRow}>
        {LEGEND.map((l) => (
          <View key={l.kind} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendLabel}>{l.label}</Text>
          </View>
        ))}
      </View>

      <Modal visible={!!selectedDate} transparent animationType="fade" onRequestClose={() => setSelectedDate(null)}>
        <Pressable style={uiStyles.modalBackdrop} onPress={() => setSelectedDate(null)}>
          <View style={[uiStyles.modalSheet, glassBlur]}>
            <Text style={uiStyles.modalTitle}>{selectedDate ? formatDate(selectedDate) : ''}</Text>
            {selectedMarkers.length === 0 ? (
              <Text style={styles.emptyModalText}>Nothing on this day.</Text>
            ) : (
              selectedMarkers.map((m, i) => (
                <View key={i} style={styles.modalItem}>
                  <View style={[styles.modalDot, { backgroundColor: m.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemLabel}>{m.label}</Text>
                    {m.detail ? <Text style={styles.modalItemDetail}>{m.detail}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}
