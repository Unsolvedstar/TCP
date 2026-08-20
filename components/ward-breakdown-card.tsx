import { Text } from 'react-native'
import { BarRow, Card } from './ui'
import { styles } from './stat-cards.styles'
import { wardColors, wardCodes, wards } from '../theme'
import type { WardStat } from '../lib/types'

export function WardBreakdownCard({ wardStats, title = 'Ward Breakdown', subtitle }: { wardStats: WardStat[]; title?: string; subtitle?: string }) {
  const max = Math.max(1, ...wards.map((w) => wardStats.find((s) => s.ward === w)?.cnt ?? 0))
  return (
    <Card>
      <Text style={styles.cardTitle}>{title}</Text>
      {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
      {wards.map((w) => (
        <BarRow key={w} label={`${w} Ward`} sub={`Ward ${wardCodes[w]}`} value={wardStats.find((s) => s.ward === w)?.cnt ?? 0} max={max} color={wardColors[w]} />
      ))}
    </Card>
  )
}
