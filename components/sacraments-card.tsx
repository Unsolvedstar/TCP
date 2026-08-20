import { Text } from 'react-native'
import { BarRow, Card } from './ui'
import { styles } from './stat-cards.styles'
import { colors } from '../theme'
import type { SacramentStat } from '../lib/types'

export function SacramentsCard({ sacraments }: { sacraments: SacramentStat }) {
  const baptPct = sacraments.total ? Math.round((sacraments.baptised / sacraments.total) * 100) : 0
  const confPct = sacraments.total ? Math.round((sacraments.confirmed / sacraments.total) * 100) : 0
  return (
    <Card>
      <Text style={styles.cardTitle}>Sacraments</Text>
      <BarRow label="Baptised" sub={`${sacraments.baptised} of ${sacraments.total}`} value={baptPct} max={100} color={colors.g700} />
      <BarRow label="Confirmed" sub={`${sacraments.confirmed} of ${sacraments.total}`} value={confPct} max={100} color={colors.gold} />
    </Card>
  )
}
