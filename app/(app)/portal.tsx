import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Card, Chip, GlassSheen, SectionLabel } from '../../components/ui'
import { PortalDetailsCard } from '../../components/portalDetailsCard'
import { PortalInvolvementCard } from '../../components/portalInvolvementCard'
import { PortalHouseholdCard } from '../../components/portalHouseholdCard'
import { PortalFamilyCard } from '../../components/portalFamilyCard'
import { WardBreakdownCard } from '../../components/wardBreakdownCard'
import { LeagueBreakdownCard } from '../../components/leagueBreakdownCard'
import { LeaguesDirectoryCard } from '../../components/leaguesDirectoryCard'
import { GenderBreakdownCard } from '../../components/genderBreakdownCard'
import { SacramentsCard } from '../../components/sacramentsCard'
import { ParishCalendarCard } from '../../components/parishCalendarCard'
import { MyLeagueCard } from '../../components/myLeagueCard'
import { MembershipCheckInBanner } from '../../components/membershipCheckInBanner'
import { CeremonyConfirmationCard } from '../../components/ceremonyConfirmationCard'
import { CertificateModal } from '../../components/certificateModal'
import { useAuth } from '../../lib/authContext'
import { useCongregationData } from '../../lib/congregationContext'
import { supabase } from '../../lib/supabase'
import { useLiturgicalSeason } from '../../lib/liturgicalTheme'
import { shouldShowMembershipCheckIn } from '../../lib/membershipCheckIn'
import { colors } from '../../theme'
import { styles } from '../../styles/portal.styles'
import type { CeremonyKind, Dependent, GenderStat, LeagueStat, SacramentStat, WardStat } from '../../lib/types'

export { ErrorBoundary } from '../../components/errorBoundary'

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
  const [sacraments, setSacraments] = useState<SacramentStat>({ total: 0, baptised: 0, confirmed: 0, adults: 0, children: 0, elders: 0 })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dependents, setDependents] = useState<Dependent[]>([])
  const [certKind, setCertKind] = useState<CeremonyKind | null>(null)
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false)

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
          {profile.league_id ? <Text style={styles.certLink} onPress={() => setCertKind('league')}>View Certificate</Text> : null}
        </View>
        <View style={styles.statCard}>
          <GlassSheen />
          <SectionLabel>Baptism</SectionLabel>
          <Chip
            label={profile.baptised ? 'Confirmed ✓' : profile.pending_baptism ? 'Pending Review' : 'Not Yet'}
            color={profile.baptised ? colors.g700 : profile.pending_baptism ? colors.gold : colors.muted}
          />
          {profile.baptised ? <Text style={styles.certLink} onPress={() => setCertKind('baptism')}>View Certificate</Text> : null}
        </View>
        <View style={styles.statCard}>
          <GlassSheen />
          <SectionLabel>Confirmation</SectionLabel>
          <Chip
            label={profile.confirmed ? 'Confirmed ✓' : profile.pending_confirmation ? 'Pending Review' : 'Not Yet'}
            color={profile.confirmed ? colors.g700 : profile.pending_confirmation ? colors.gold : colors.muted}
          />
          {profile.confirmed ? <Text style={styles.certLink} onPress={() => setCertKind('confirmation')}>View Certificate</Text> : null}
        </View>
      </View>

      {certKind ? (
        <CertificateModal
          visible
          onClose={() => setCertKind(null)}
          kind={certKind}
          subjectId={profile.id}
          isDependent={false}
          name={profile.full_name}
          application={certKind === 'baptism' ? profile.baptism_application : certKind === 'confirmation' ? profile.confirmation_application : profile.league_application}
          reviewedAt={profile.reviewed_at}
          league={certKind === 'league' ? leagues.find((l) => l.id === profile.league_id) ?? null : null}
          dateOfBirth={profile.date_of_birth}
        />
      ) : null}

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
          <PortalFamilyCard />
          <PortalHouseholdCard dependents={dependents} onChanged={loadAll} />

          {announcements.length ? (
            <Card>
              <Text style={styles.cardTitle}>Parish Announcements</Text>
              <Text style={styles.cardSub}>What's coming up at Tshwane City Parish</Text>
              {(showAllAnnouncements ? announcements : announcements.slice(0, 3)).map((a) => (
                <View key={a.id} style={styles.annItem}>
                  <Text style={styles.annDate}>{a.date_text}</Text>
                  <Text style={styles.annTitle}>{a.title}</Text>
                  {a.poster ? <Image source={{ uri: a.poster }} style={styles.annPoster} resizeMode="cover" /> : null}
                  <Text style={styles.annBody}>{a.body}</Text>
                </View>
              ))}
              {announcements.length > 3 ? (
                <Text style={styles.certLink} onPress={() => setShowAllAnnouncements((v) => !v)}>
                  {showAllAnnouncements ? 'Show fewer' : `Show all ${announcements.length} announcements`}
                </Text>
              ) : null}
            </Card>
          ) : null}

          <WardBreakdownCard
            wardStats={wardStats}
            title="Parish at a Glance"
            subtitle={`${sacraments.total} people across 5 wards: ${sacraments.adults} adults, ${sacraments.elders} elders, ${sacraments.children} children`}
          />
          <GenderBreakdownCard genderStats={genderStats} />
          <SacramentsCard sacraments={sacraments} />
        </>
      ) : section === 'leagues' ? (
        <>
          <MyLeagueCard />
          <LeaguesDirectoryCard leagueStats={leagueStats} />
          <LeagueBreakdownCard leagueStats={leagueStats} />
        </>
      ) : (
        <ParishCalendarCard />
      )}
    </ScrollView>
  )
}
