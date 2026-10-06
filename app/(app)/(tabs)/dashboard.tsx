import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { GlassSheen, HeroDecor } from '../../../components/ui'
import { WardBreakdownCard } from '../../../components/wardBreakdownCard'
import { LeagueBreakdownCard } from '../../../components/leagueBreakdownCard'
import { LeaguesDirectoryCard } from '../../../components/leaguesDirectoryCard'
import { GenderBreakdownCard } from '../../../components/genderBreakdownCard'
import { SacramentsCard } from '../../../components/sacramentsCard'
import { ParishCalendarCard } from '../../../components/parishCalendarCard'
import { MembershipCheckInBanner } from '../../../components/membershipCheckInBanner'
import { supabase } from '../../../lib/supabase'
import { useLiturgicalSeason } from '../../../lib/liturgicalTheme'
import { useAuth } from '../../../lib/authContext'
import { useCongregationData } from '../../../lib/congregationContext'
import { shouldShowMembershipCheckIn } from '../../../lib/membershipCheckIn'
import { colors, radius } from '../../../theme'
import { styles } from '../../../styles/dashboard.styles'
import type { GenderStat, LeagueStat, SacramentStat, WardStat } from '../../../lib/types'

export { ErrorBoundary } from '../../../components/errorBoundary'

export default function Dashboard() {
  const router = useRouter()
  const { profile } = useAuth()
  const { wards } = useCongregationData()
  const season = useLiturgicalSeason()
  const [section, setSection] = useState<'dashboard' | 'leagues' | 'calendar'>('dashboard')
  const [refreshing, setRefreshing] = useState(false)
  const [wardStats, setWardStats] = useState<WardStat[]>([])
  const [leagueStats, setLeagueStats] = useState<LeagueStat[]>([])
  const [genderStats, setGenderStats] = useState<GenderStat[]>([])
  const [sacraments, setSacraments] = useState<SacramentStat>({ total: 0, baptised: 0, confirmed: 0, adults: 0, children: 0, elders: 0 })
  const [pendingCount, setPendingCount] = useState(0)

  const loadAll = useCallback(async () => {
    const [{ data: ws }, { data: ls }, { data: gs }, { data: sac }, { data: pending }, { data: depPending }] = await Promise.all([
      supabase.rpc('stats_by_ward'),
      supabase.rpc('stats_by_league'),
      supabase.rpc('stats_by_gender'),
      supabase.rpc('stats_sacraments'),
      supabase.from('profiles').select('pending_league_id,pending_baptism,pending_confirmation'),
      supabase.from('dependents').select('pending_league_id,pending_baptism,pending_confirmation'),
    ])
    setWardStats((ws as WardStat[]) ?? [])
    setLeagueStats((ls as LeagueStat[]) ?? [])
    setGenderStats((gs as GenderStat[]) ?? [])
    if (sac && (sac as SacramentStat[]).length) setSacraments((sac as SacramentStat[])[0])
    const countIn = (rows: any[] | null) => (rows ?? []).reduce((n: number, m: any) => n + (m.pending_league_id ? 1 : 0) + (m.pending_baptism ? 1 : 0) + (m.pending_confirmation ? 1 : 0), 0)
    setPendingCount(countIn(pending) + countIn(depPending))
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadAll()
    }, [loadAll])
  )

  async function onRefresh() {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.g700} />}
    >
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <HeroDecor />
        <View style={styles.heroSeasonPill}>
          <Text style={[styles.heroSeasonPillText, { color: season.text }]}>{season.name.toUpperCase()}</Text>
        </View>
        <Text style={[styles.heroTitle, { color: season.text }]}>ELCSA Tshwane City Parish</Text>
        <Text style={[styles.heroSub, { color: season.text }]}>Growing Together in Christ</Text>
        <View style={styles.heroTotal}>
          <Text style={[styles.heroTotalN, { color: season.text }]}>{sacraments.total}</Text>
          <Text style={[styles.heroTotalL, { color: season.text }]}>People In The Church</Text>
        </View>
        <Text style={[styles.heroBreakdown, { color: season.text }]}>
          {sacraments.adults} adults, {sacraments.elders} elders, {sacraments.children} children
        </Text>
      </View>

      {pendingCount > 0 ? (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingText}>{pendingCount} pending request{pendingCount !== 1 ? 's' : ''}</Text>
          <Text style={styles.pendingLink} onPress={() => router.push('/members')}>
            Review →
          </Text>
        </View>
      ) : null}

      {profile && shouldShowMembershipCheckIn(profile) ? <MembershipCheckInBanner /> : null}

      <View style={styles.tabRow}>
        <Text onPress={() => setSection('dashboard')} style={[styles.tabBtn, section === 'dashboard' && styles.tabBtnActive]}>
          Dashboard
        </Text>
        <Text onPress={() => setSection('leagues')} style={[styles.tabBtn, section === 'leagues' && styles.tabBtnActive]}>
          Leagues
        </Text>
        <Text onPress={() => setSection('calendar')} style={[styles.tabBtn, section === 'calendar' && styles.tabBtnActive]}>
          Calendar
        </Text>
      </View>

      {section === 'dashboard' ? (
        <>
          <View style={styles.wardGrid}>
            {wards.map((w) => (
              <View key={w.id} style={[styles.wardCard, { borderTopColor: w.color }]}>
                <GlassSheen cornerRadius={radius.md} />
                <Text style={styles.wardLabel}>{w.name}</Text>
                <Text style={styles.wardNum}>{wardStats.find((s) => s.ward_id === w.id)?.cnt ?? 0}</Text>
                <Text style={styles.wardCode}>Ward {w.bank_code}</Text>
              </View>
            ))}
          </View>

          <WardBreakdownCard wardStats={wardStats} />
          <GenderBreakdownCard genderStats={genderStats} />
          <SacramentsCard sacraments={sacraments} />
        </>
      ) : section === 'leagues' ? (
        <>
          <LeaguesDirectoryCard leagueStats={leagueStats} />
          <LeagueBreakdownCard leagueStats={leagueStats} />
        </>
      ) : (
        <ParishCalendarCard />
      )}
    </ScrollView>
  )
}
