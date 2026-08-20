import { Text, View } from 'react-native'
import { Card, formatDate } from './ui'
import { styles } from './church-calendar-card.styles'
import { styles as statStyles } from './stat-cards.styles'
import { getUpcomingChurchEvents } from '../lib/church-calendar'
import { formatShortDate, toLocalISODate } from '../lib/dates'

export function ChurchCalendarCard({ count = 6 }: { count?: number }) {
  const today = new Date()
  const todayIso = toLocalISODate(today)
  const events = getUpcomingChurchEvents(today, count)

  if (!events.length) return null

  return (
    <Card>
      <Text style={statStyles.cardTitle}>Church Calendar</Text>
      <Text style={statStyles.cardSub}>Upcoming observances of the Christian year</Text>
      {events.map((e, i) => {
        const isNow = e.endDate ? e.date <= todayIso && todayIso <= e.endDate : e.date === todayIso
        return (
          <View key={i} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>
                {e.name} {isNow ? <Text style={styles.nowBadge}> · now</Text> : null}
              </Text>
              {e.note ? <Text style={styles.note}>{e.note}</Text> : null}
            </View>
            <Text style={styles.date}>{e.endDate ? `${formatShortDate(e.date)} – ${formatShortDate(e.endDate)}` : formatDate(e.date)}</Text>
          </View>
        )
      })}
    </Card>
  )
}
