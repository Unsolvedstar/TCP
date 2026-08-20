import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Card } from './ui'
import { hasLeagueBadge, LeagueBadge } from './league-badge'
import { styles as statStyles } from './stat-cards.styles'
import { styles } from './leagues-directory-card.styles'
import { colors, leagueKeys, leagues } from '../theme'
import type { LeagueKey, LeagueStat } from '../lib/types'

export function LeaguesDirectoryCard({ leagueStats }: { leagueStats: LeagueStat[] }) {
  const keys = leagueKeys.filter((k) => k !== 'None') as LeagueKey[]
  return (
    <Card>
      <Text style={statStyles.cardTitle}>Leagues & Organisations</Text>
      <Text style={statStyles.cardSub}>Every league and organisation at Tshwane City Parish</Text>
      {keys.map((k) => {
        const league = leagues[k]
        const count = leagueStats.find((s) => s.league === k)?.cnt ?? 0
        return (
          <View key={k} style={styles.row}>
            {hasLeagueBadge(k) ? (
              <LeagueBadge leagueKey={k} size={34} />
            ) : (
              <View style={[styles.dot, { backgroundColor: league.color }]}>
                <Ionicons name={(league.icon ?? 'people-outline') as any} size={18} color={colors.white} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{league.label}</Text>
              {league.info ? <Text style={styles.info}>{league.info}</Text> : null}
            </View>
            <Text style={styles.count}>{count}</Text>
          </View>
        )
      })}
    </Card>
  )
}
