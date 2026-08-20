import { Text } from 'react-native'
import { BarRow, Card } from './ui'
import { styles } from './stat-cards.styles'
import { leagueKeys, leagues } from '../theme'
import type { LeagueStat } from '../lib/types'

export function LeagueBreakdownCard({ leagueStats }: { leagueStats: LeagueStat[] }) {
  const keys = leagueKeys.filter((k) => k !== 'None')
  const max = Math.max(1, ...keys.map((k) => leagueStats.find((s) => s.league === k)?.cnt ?? 0))
  return (
    <Card>
      <Text style={styles.cardTitle}>League Breakdown</Text>
      {keys.map((k) => (
        <BarRow key={k} label={leagues[k].label} value={leagueStats.find((s) => s.league === k)?.cnt ?? 0} max={max} color={leagues[k].color} />
      ))}
    </Card>
  )
}
