import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import { BarRow, Button, Card, Field, SelectField } from './ui'
import { styles as statStyles } from './stat-cards.styles'
import { supabase } from '../lib/supabase'
import { useCongregationData } from '../lib/congregation-context'
import { colors } from '../theme'

type LeaderboardRow = { league_id: string; total_points: number }
type PointsLedgerRow = { id: string; league_id: string; points: number; reason: string; source: string; created_at: string }

const RANK_COLORS = [colors.gold, colors.g700, '#a97142']

export function LeagueLeaderboardCard({ isAdmin = false }: { isAdmin?: boolean }) {
  const { leagues } = useCongregationData()
  const [totals, setTotals] = useState<LeaderboardRow[]>([])
  const [ledger, setLedger] = useState<PointsLedgerRow[]>([])
  const [showLedger, setShowLedger] = useState(false)
  const [awardLeagueId, setAwardLeagueId] = useState('')
  const [awardPoints, setAwardPoints] = useState('')
  const [awardReason, setAwardReason] = useState('')
  const [awarding, setAwarding] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('league_leaderboard')
    setTotals((data as LeaderboardRow[]) ?? [])
    if (isAdmin) {
      const { data: le } = await supabase.from('league_points').select('id, league_id, points, reason, source, created_at').order('created_at', { ascending: false }).limit(30)
      setLedger((le as PointsLedgerRow[]) ?? [])
    }
  }, [isAdmin])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  const ranked = leagues
    .map((l) => ({ league: l, points: totals.find((t) => t.league_id === l.id)?.total_points ?? 0 }))
    .sort((a, b) => b.points - a.points)
  const max = Math.max(1, ...ranked.map((r) => r.points))

  async function submitAward() {
    const points = Number(awardPoints)
    if (!awardLeagueId || !Number.isFinite(points) || points === 0 || !awardReason.trim()) {
      Alert.alert('Missing info', 'Please pick a league, a non-zero point amount, and a reason.')
      return
    }
    setAwarding(true)
    const { error } = await supabase.rpc('admin_award_league_points', { target_league_id: awardLeagueId, p_points: points, p_reason: awardReason.trim() })
    setAwarding(false)
    if (error) {
      Alert.alert('Could not award points', error.message)
      return
    }
    setAwardLeagueId('')
    setAwardPoints('')
    setAwardReason('')
    load()
  }

  return (
    <Card>
      <Text style={statStyles.cardTitle}>League Leaderboard</Text>
      <Text style={statStyles.cardSub}>Points for posting announcements and events, and for welcoming new members</Text>
      {ranked.map((r, i) => (
        <View key={r.league.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {i < 3 ? <Text style={{ fontSize: 12, fontWeight: '800', color: RANK_COLORS[i], width: 20 }}>#{i + 1}</Text> : <View style={{ width: 20 }} />}
          <View style={{ flex: 1 }}>
            <BarRow label={r.league.label} value={r.points} max={max} color={r.league.color} />
          </View>
        </View>
      ))}

      {isAdmin ? (
        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.cream, gap: 10 }}>
          <Text style={[statStyles.cardTitle, { fontSize: 13 }]}>Award Points</Text>
          <SelectField label="League" value={awardLeagueId} onChange={setAwardLeagueId} options={leagues.map((l) => ({ value: l.id, label: l.label }))} placeholder="Select a league…" />
          <Field label="Points (can be negative to correct a mistake)" value={awardPoints} onChangeText={setAwardPoints} keyboardType="numeric" placeholder="e.g. 10" />
          <Field label="Reason" value={awardReason} onChangeText={setAwardReason} placeholder="e.g. Hosted the outreach day" />
          <Button title="Award Points" onPress={submitAward} loading={awarding} />

          <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.g700 }} onPress={() => setShowLedger(!showLedger)}>
            {showLedger ? 'Hide' : 'Show'} points history ({ledger.length})
          </Text>
          {showLedger
            ? ledger.map((row) => {
                const league = leagues.find((l) => l.id === row.league_id)
                return (
                  <View key={row.id} style={{ flexDirection: 'row', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.cream }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: row.points >= 0 ? colors.g700 : colors.danger, width: 34 }}>
                      {row.points >= 0 ? '+' : ''}
                      {row.points}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, color: colors.text }}>
                        {league?.label ?? 'Unknown league'} — {row.reason}
                      </Text>
                      <Text style={{ fontSize: 10.5, color: colors.muted }}>{new Date(row.created_at).toLocaleDateString('en-ZA')}</Text>
                    </View>
                  </View>
                )
              })
            : null}
        </View>
      ) : null}
    </Card>
  )
}
