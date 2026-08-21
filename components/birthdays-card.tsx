import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card, formatDate } from './ui'
import { styles } from './stat-cards.styles'
import { useCongregationData } from '../lib/congregation-context'
import { colors } from '../theme'
import type { Birthday } from '../lib/types'

export function BirthdaysCard({ birthdays, subtitle = 'Next 30 days', showWard = false }: { birthdays: Birthday[]; subtitle?: string; showWard?: boolean }) {
  const { wards } = useCongregationData()
  if (!birthdays.length) return null
  return (
    <Card>
      <Text style={styles.cardTitle}>Upcoming Birthdays</Text>
      <Text style={styles.cardSub}>{subtitle}</Text>
      {birthdays.map((b, i) => (
        <View key={i} style={styles.bdayRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 }}>
            {b.is_child ? <Ionicons name="body-outline" size={14} color={colors.muted} /> : null}
            <Text style={styles.bdayName}>
              {b.full_name}
              {showWard ? <Text style={styles.bdayWard}> ({wards.find((w) => w.id === b.ward_id)?.name ?? '—'})</Text> : null}
            </Text>
          </View>
          <Text style={styles.bdayDate}>{formatDate(b.next_birthday)}</Text>
        </View>
      ))}
    </Card>
  )
}
