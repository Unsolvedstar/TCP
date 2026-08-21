import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Card, Chip, GlassSheen, SectionLabel } from '../../components/ui'
import { PortalDetailsCard } from '../../components/portal-details-card'
import { PortalInvolvementCard } from '../../components/portal-involvement-card'
import { PortalHouseholdCard } from '../../components/portal-household-card'
import { WardBreakdownCard } from '../../components/ward-breakdown-card'
import { LeagueBreakdownCard } from '../../components/league-breakdown-card'
import { LeaguesDirectoryCard } from '../../components/leagues-directory-card'
import { GenderBreakdownCard } from '../../components/gender-breakdown-card'
import { SacramentsCard } from '../../components/sacraments-card'
import { ParishCalendarCard } from '../../components/parish-calendar-card'
import { LeagueLeaderboardCard } from '../../components/league-leaderboard-card'
import { MyLeagueCard } from '../../components/my-league-card'
import { MembershipCheckInBanner } from '../../components/membership-check-in-banner'
import { CeremonyConfirmationCard } from '../../components/ceremony-confirmation-card'
import { useAuth } from '../../lib/auth-context'
import { useCongregationData } from '../../lib/congregation-context'
import { supabase } from '../../lib/supabase'
import { useLiturgicalSeason } from '../../lib/liturgical-theme'
import { shouldShowMembershipCheckIn } from '../../lib/membership-check-in'
import { colors } from '../../theme'
import { styles } from '../../styles/portal.styles'
import type { Dependent, GenderStat, LeagueStat, SacramentStat, WardStat } from '../../lib/types'

export { ErrorBoundary } from '../../components/error-boundary'

type Announcement = { id: string; title: string; date_text: string; body: string; poster: string | null }

export default function Portal() {
  const { profile, refreshProfile } = useAuth()
  const { wards, leagues } = useCongregationData()
  const season = useLiturgicalSeason()
  const [section, setSection] = useState<'dashboard' | 'leagues' | 'calendar'>('dashboard')
  const [refreshing, setRefreshing] = useState(false)
  const [wardStats, setWardStats] = useState<WardStat[]>([])
  const [leagueStats, setLeagueStats] = useState<LeagueStat[]>([])
  const [genderStats, setGenderStats] = useState<GenderStat[]>([])
  const [sacraments, setSacraments] = useState<SacramentStat>({ total: 0, baptised: 0, confirmed: 0, adults: 0, children: 0 })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dependents, setDependents] = useState<Dependent[]>([])

  const loadAll = useCallback(async () => {
    const [{ data: ws }, { data: ls }, { data: gs }, { data: sac }, { data: ann }, { data: deps }] = await Promise.all([
      supabase.rpc('stats_by_ward'),
      supabase.rpc('stats_by_league'),
      supabase.rpc('stats_by_gender'),
      supabase.rpc('stats_sacraments'),
      supabase.from('announcements').select('id,title,date_text,body,poster').order('created_at', { ascending: false }),
      supabase.from('dependents').select('*').order('full_name'),
    ])
    setWardStats((ws as WardStat[]) ?? [])
    setLeagueStats((ls as LeagueStat[]) ?? [])
    setGenderStats((gs as GenderStat[]) ?? [])
    if (sac && (sac as SacramentStat[]).length) setSacraments((sac as SacramentStat[])[0])
    setAnnouncements((ann as Announcement[]) ?? [])
    setDependents((deps as Dependent[]) ?? [])
    await refreshProfile()
  }, [refreshProfile])

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

  if (!profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.g700} size="large" />
      </View>
    )
  }

  const myWard = wards.find((w) => w.id === profile.ward_id)
  const myLeague = leagues.find((l) => l.id === profile.league_id) ?? { label: 'No League / Organisation', color: '#9e9e9e' }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.g700} />}
    >
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <View style={styles.heroSeasonPill}>
          <Text style={[styles.heroSeasonPillText, { color: season.text }]}>{season.name.toUpperCase()}</Text>
        </View>
        <Text style={[styles.heroName, { color: season.text }]}>Welcome, {profile.full_name.split(' ')[0]}</Text>
        <Text style={[styles.heroSub, { color: season.text }]}>{myWard?.name ?? '—'} Ward, ELCSA Tshwane City Parish</Text>
      </View>

      {shouldShowMembershipCheckIn(profile) ? <MembershipCheckInBanner /> : null}

      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <GlassSheen />
          <SectionLabel>Ward</SectionLabel>
          {myWard ? <Chip label={myWard.name} color={myWard.color} /> : null}
        </View>
        <View style={styles.statCard}>
          <GlassSheen />
          <SectionLabel>League</SectionLabel>
          <Chip label={myLeague.label} color={myLeague.color} />
          {profile.pending_league_id ? <Text style={styles.pendingNote}>Pending review</Text> : null}
        </View>
        <View style={styles.statCard}>
          <GlassSheen />
          <SectionLabel>Baptism</SectionLabel>
          <Chip
            label={profile.baptised ? 'Confirmed ✓' : profile.pending_baptism ? 'Pending Review' : 'Not Yet'}
            color={profile.baptised ? colors.g700 : profile.pending_baptism ? colors.gold : colors.muted}
          />
        </View>
        <View style={styles.statCard}>
          <GlassSheen />
          <SectionLabel>Confirmation</SectionLabel>
          <Chip
            label={profile.confirmed ? 'Confirmed ✓' : profile.pending_confirmation ? 'Pending Review' : 'Not Yet'}
            color={profile.confirmed ? colors.g700 : profile.pending_confirmation ? colors.gold : colors.muted}
          />
        </View>
      </View>

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
          <CeremonyConfirmationCard />
          <PortalDetailsCard profile={profile} onChanged={loadAll} />
          <PortalInvolvementCard profile={profile} onChanged={loadAll} />
          <PortalHouseholdCard dependents={dependents} onChanged={loadAll} />

          {announcements.length ? (
            <Card>
              <Text style={styles.cardTitle}>Parish Announcements</Text>
              <Text style={styles.cardSub}>What's coming up at Tshwane City Parish</Text>
              {announcements.map((a) => (
                <View key={a.id} style={styles.annItem}>
                  <Text style={styles.annDate}>{a.date_text}</Text>
                  <Text style={styles.annTitle}>{a.title}</Text>
                  {a.poster ? <Image source={{ uri: a.poster }} style={styles.annPoster} resizeMode="cover" /> : null}
                  <Text style={styles.annBody}>{a.body}</Text>
                </View>
              ))}
            </Card>
          ) : null}

          <WardBreakdownCard
            wardStats={wardStats}
            title="Parish at a Glance"
            subtitle={`${sacraments.total} people across 5 wards: ${sacraments.adults} adults, ${sacraments.children} children`}
          />
          <GenderBreakdownCard genderStats={genderStats} />
          <SacramentsCard sacraments={sacraments} />
        </>
      ) : section === 'leagues' ? (
        <>
          <MyLeagueCard />
          <LeagueLeaderboardCard />
          <LeaguesDirectoryCard leagueStats={leagueStats} />
          <LeagueBreakdownCard leagueStats={leagueStats} />
        </>
      ) : (
        <ParishCalendarCard />
      )}
    </ScrollView>
  )
}
