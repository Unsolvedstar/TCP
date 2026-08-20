import { Text, View } from 'react-native'
import { Card, formatDate } from './ui'
import { styles } from './stat-cards.styles'
import type { Birthday } from '../lib/types'

export function BirthdaysCard({ birthdays, subtitle = 'Next 30 days', showWard = false }: { birthdays: Birthday[]; subtitle?: string; showWard?: boolean }) {
  if (!birthdays.length) return null
  return (
    <Card>
      <Text style={styles.cardTitle}>Upcoming Birthdays</Text>
      <Text style={styles.cardSub}>{subtitle}</Text>
      {birthdays.map((b, i) => (
        <View key={i} style={styles.bdayRow}>
          <Text style={styles.bdayName}>
            {b.full_name} {b.is_child ? '👶' : ''}
            {showWard ? <Text style={styles.bdayWard}> · {b.ward}</Text> : null}
          </Text>
          <Text style={styles.bdayDate}>{formatDate(b.next_birthday)}</Text>
        </View>
      ))}
    </Card>
  )
}
