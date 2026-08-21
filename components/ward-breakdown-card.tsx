import { Text } from 'react-native'
import { BarRow, Card } from './ui'
import { styles } from './stat-cards.styles'
import { useCongregationData } from '../lib/congregation-context'
import type { WardStat } from '../lib/types'

export function WardBreakdownCard({ wardStats, title = 'Ward Breakdown', subtitle }: { wardStats: WardStat[]; title?: string; subtitle?: string }) {
  const { wards } = useCongregationData()
  const max = Math.max(1, ...wards.map((w) => wardStats.find((s) => s.ward_id === w.id)?.cnt ?? 0))
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      {wards.map((w) => (
        <BarRow key={w.id} label={`${w.name} Ward`} sub={`Ward ${w.bank_code}`} value={wardStats.find((s) => s.ward_id === w.id)?.cnt ?? 0} max={max} color={w.color} />
      ))}
    </Card>
  )
}
