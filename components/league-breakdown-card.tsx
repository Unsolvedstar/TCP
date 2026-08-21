import { Text } from 'react-native'
import { BarRow, Card } from './ui'
import { styles } from './stat-cards.styles'
import { useCongregationData } from '../lib/congregation-context'
import type { LeagueStat } from '../lib/types'

export function LeagueBreakdownCard({ leagueStats }: { leagueStats: LeagueStat[] }) {
  const { leagues } = useCongregationData()
  const max = Math.max(1, ...leagues.map((l) => leagueStats.find((s) => s.league_id === l.id)?.cnt ?? 0))
  return (
    <Card>
      <Text style={styles.cardTitle}>League Breakdown</Text>
      {leagues.map((l) => (
        <BarRow key={l.id} label={l.label} value={leagueStats.find((s) => s.league_id === l.id)?.cnt ?? 0} max={max} color={l.color} />
      ))}
    </Card>
  )
}
