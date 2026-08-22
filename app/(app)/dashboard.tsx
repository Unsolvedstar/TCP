import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Image, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { Alert } from '../../lib/alert'
import { Button, Card, GlassSheen } from '../../components/ui'
import { CertificatePicker } from '../../components/certificate-picker'
import { WardBreakdownCard } from '../../components/ward-breakdown-card'
import { LeagueBreakdownCard } from '../../components/league-breakdown-card'
import { LeaguesDirectoryCard } from '../../components/leagues-directory-card'
import { GenderBreakdownCard } from '../../components/gender-breakdown-card'
import { SacramentsCard } from '../../components/sacraments-card'
import { ParishCalendarCard } from '../../components/parish-calendar-card'
import { LeagueLeaderboardCard } from '../../components/league-leaderboard-card'
import { MembershipCheckInBanner } from '../../components/membership-check-in-banner'
import { supabase } from '../../lib/supabase'
import { useLiturgicalSeason } from '../../lib/liturgical-theme'
import { useAuth } from '../../lib/auth-context'
import { useCongregationData } from '../../lib/congregation-context'
import { shouldShowMembershipCheckIn } from '../../lib/membership-check-in'
import { colors, radius } from '../../theme'
import { styles } from '../../styles/dashboard.styles'
import type { GenderStat, LeagueStat, SacramentStat, WardStat } from '../../lib/types'

export { ErrorBoundary } from '../../components/error-boundary'

type Announcement = { id: string; title: string; date_text: string; body: string; poster: string | null; league_id: string | null }

export default function Dashboard() {
  const router = useRouter()
  const { profile } = useAuth()
  const { wards, leagues } = useCongregationData()
  const season = useLiturgicalSeason()
  const [section, setSection] = useState<'dashboard' | 'leagues' | 'calendar'>('dashboard')
  const [refreshing, setRefreshing] = useState(false)
  const [wardStats, setWardStats] = useState<WardStat[]>([])
  const [leagueStats, setLeagueStats] = useState<LeagueStat[]>([])
  const [genderStats, setGenderStats] = useState<GenderStat[]>([])
  const [sacraments, setSacraments] = useState<SacramentStat>({ total: 0, baptised: 0, confirmed: 0, adults: 0, children: 0, elders: 0 })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [title, setTitle] = useState('')
  const [dateText, setDateText] = useState('')
  const [body, setBody] = useState('')
  const [poster, setPoster] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    const [{ data: ws }, { data: ls }, { data: gs }, { data: sac }, { data: ann }, { data: pending }, { data: depPending }] = await Promise.all([
      supabase.rpc('stats_by_ward'),
      supabase.rpc('stats_by_league'),
      supabase.rpc('stats_by_gender'),
      supabase.rpc('stats_sacraments'),
      supabase.from('announcements').select('id,title,date_text,body,poster,league_id').order('created_at', { ascending: false }),
      supabase.from('profiles').select('pending_league_id,pending_baptism,pending_confirmation').eq('role', 'member'),
      supabase.from('dependents').select('pending_league_id,pending_baptism,pending_confirmation'),
    ])
    setWardStats((ws as WardStat[]) ?? [])
    setLeagueStats((ls as LeagueStat[]) ?? [])
    setGenderStats((gs as GenderStat[]) ?? [])
    if (sac && (sac as SacramentStat[]).length) setSacraments((sac as SacramentStat[])[0])
    setAnnouncements((ann as Announcement[]) ?? [])
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

  async function addAnnouncement() {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a title.')
      return
    }
    if (!profile) return
    setSaving(true)
    const { error } = await supabase
      .from('announcements')
      .insert({ congregation_id: profile.congregation_id, title: title.trim(), date_text: dateText.trim(), body: body.trim(), poster })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setTitle('')
    setDateText('')
    setBody('')
    setPoster(null)
    loadAll()
  }

  async function removeAnnouncement(id: string) {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) Alert.alert('Could not remove', error.message)
    else loadAll()
  }

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
          <Text style={styles.pendingLink} onPress={() => router.push('/(app)/members')}>
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

          <Card>
            <Text style={styles.cardTitle}>Parish Announcements</Text>
            <Text style={styles.cardSub}>Every announcement across the parish — whole-church and league-posted alike. This form always posts whole-church; use League Tools to post as a specific league.</Text>
            <View style={styles.form}>
              <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title, e.g. Harvest Celebration" placeholderTextColor="#a99" />
              <TextInput style={styles.input} value={dateText} onChangeText={setDateText} placeholder="Date / when, e.g. 18 October 2026" placeholderTextColor="#a99" />
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                value={body}
                onChangeText={setBody}
                placeholder="Short description…"
                placeholderTextColor="#a99"
                multiline
              />
              <CertificatePicker label="Poster (optional)" value={poster} onChange={setPoster} />
              <Button title="Add Announcement" onPress={addAnnouncement} loading={saving} />
            </View>
            {announcements.map((a) => {
              const league = a.league_id ? leagues.find((l) => l.id === a.league_id) : null
              return (
                <View key={a.id} style={styles.annItem}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.annDate}>{a.date_text}</Text>
                          <Text style={[styles.audienceTag, league ? { color: league.color, backgroundColor: league.color + '1a' } : null]}>
                            {league ? league.label : 'Whole Church'}
                          </Text>
                        </View>
                        <Text style={styles.annTitle}>{a.title}</Text>
                      </View>
                      <Text style={styles.removeLink} onPress={() => removeAnnouncement(a.id)}>
                        Remove
                      </Text>
                    </View>
                    {a.poster ? <Image source={{ uri: a.poster }} style={styles.annPoster} resizeMode="cover" /> : null}
                    <Text style={styles.annBody}>{a.body}</Text>
                  </View>
                </View>
              )
            })}
          </Card>
        </>
      ) : section === 'leagues' ? (
        <>
          <LeagueLeaderboardCard isAdmin />
          <LeaguesDirectoryCard leagueStats={leagueStats} />
          <LeagueBreakdownCard leagueStats={leagueStats} />
        </>
      ) : (
        <ParishCalendarCard />
      )}
    </ScrollView>
  )
}
