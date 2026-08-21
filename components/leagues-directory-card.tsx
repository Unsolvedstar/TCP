import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Card } from './ui'
import { hasLeagueBadge, LeagueBadge } from './league-badge'
import { ElcsasoModal } from './elcsaso-modal'
import { styles as statStyles } from './stat-cards.styles'
import { styles } from './leagues-directory-card.styles'
import { useCongregationData } from '../lib/congregation-context'
import type { LeagueStat } from '../lib/types'

export function LeaguesDirectoryCard({ leagueStats }: { leagueStats: LeagueStat[] }) {
  const { leagues } = useCongregationData()
  const [elcsasoOpen, setElcsasoOpen] = useState(false)

  return (
    <Card>
      <Text style={statStyles.cardTitle}>Leagues & Organisations</Text>
      <Text style={statStyles.cardSub}>Every league and organisation at Tshwane City Parish</Text>
      {leagues.map((league) => {
        const count = leagueStats.find((s) => s.league_id === league.id)?.cnt ?? 0
        const badge = hasLeagueBadge(league.key) ? <LeagueBadge leagueKey={league.key} size={34} /> : <View style={[styles.dot, { backgroundColor: league.color }]} />
        const row = (
          <View style={styles.row}>
            {badge}
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{league.label}</Text>
              {league.info ? <Text style={styles.info}>{league.info}</Text> : null}
              {league.key === 'ELCSASO' ? <Text style={styles.tapHint}>Tap to see UP, Eduvos & TUT chapters →</Text> : null}
            </View>
            <Text style={styles.count}>{count}</Text>
          </View>
        )
        if (league.key !== 'ELCSASO') return <View key={league.id}>{row}</View>
        return (
          <Pressable key={league.id} onPress={() => setElcsasoOpen(true)}>
            {row}
          </Pressable>
        )
      })}

      {elcsasoOpen ? <ElcsasoModal onClose={() => setElcsasoOpen(false)} /> : null}
    </Card>
  )
}
