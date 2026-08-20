import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Alert, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native'
import { Button, Card } from '../../components/ui'
import { WardBreakdownCard } from '../../components/ward-breakdown-card'
import { LeagueBreakdownCard } from '../../components/league-breakdown-card'
import { GenderBreakdownCard } from '../../components/gender-breakdown-card'
import { SacramentsCard } from '../../components/sacraments-card'
import { BirthdaysCard } from '../../components/birthdays-card'
import { ChurchCalendarCard } from '../../components/church-calendar-card'
import { supabase } from '../../lib/supabase'
import { useLiturgicalSeason } from '../../lib/liturgical-theme'
import { colors, wardColors, wardCodes, wards } from '../../theme'
import { styles } from '../../styles/dashboard.styles'
import type { Birthday, GenderStat, LeagueStat, SacramentStat, WardStat } from '../../lib/types'

export { ErrorBoundary } from '../../components/error-boundary'

type Announcement = { id: string; title: string; date_text: string; body: string }

export default function Dashboard() {
  const router = useRouter()
  const season = useLiturgicalSeason()
  const [section, setSection] = useState<'dashboard' | 'calendar'>('dashboard')
  const [refreshing, setRefreshing] = useState(false)
  const [wardStats, setWardStats] = useState<WardStat[]>([])
  const [leagueStats, setLeagueStats] = useState<LeagueStat[]>([])
  const [genderStats, setGenderStats] = useState<GenderStat[]>([])
  const [sacraments, setSacraments] = useState<SacramentStat>({ total: 0, baptised: 0, confirmed: 0, adults: 0, children: 0 })
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [title, setTitle] = useState('')
  const [dateText, setDateText] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const loadAll = useCallback(async () => {
    const [{ data: ws }, { data: ls }, { data: gs }, { data: sac }, { data: ann }, { data: bdays }, { data: pending }, { data: depPending }] = await Promise.all([
      supabase.rpc('stats_by_ward'),
      supabase.rpc('stats_by_league'),
      supabase.rpc('stats_by_gender'),
      supabase.rpc('stats_sacraments'),
      supabase.from('announcements').select('id,title,date_text,body').order('created_at', { ascending: false }),
      supabase.rpc('upcoming_birthdays', { days_ahead: 30 }),
      supabase.from('profiles').select('pending_league,pending_baptism,pending_confirmation').eq('role', 'member'),
      supabase.from('dependents').select('pending_league,pending_baptism,pending_confirmation'),
    ])
    setWardStats((ws as WardStat[]) ?? [])
    setLeagueStats((ls as LeagueStat[]) ?? [])
    setGenderStats((gs as GenderStat[]) ?? [])
    if (sac && (sac as SacramentStat[]).length) setSacraments((sac as SacramentStat[])[0])
    setAnnouncements((ann as Announcement[]) ?? [])
    setBirthdays((bdays as Birthday[]) ?? [])
    const countIn = (rows: any[] | null) => (rows ?? []).reduce((n: number, m: any) => n + (m.pending_league ? 1 : 0) + (m.pending_baptism ? 1 : 0) + (m.pending_confirmation ? 1 : 0), 0)
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
    setSaving(true)
    const { error } = await supabase.from('announcements').insert({ title: title.trim(), date_text: dateText.trim(), body: body.trim() })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setTitle('')
    setDateText('')
    setBody('')
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
          {sacraments.adults} adults, {sacraments.children} children
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

      <View style={styles.tabRow}>
        <Text onPress={() => setSection('dashboard')} style={[styles.tabBtn, section === 'dashboard' && styles.tabBtnActive]}>
          Dashboard
        </Text>
        <Text onPress={() => setSection('calendar')} style={[styles.tabBtn, section === 'calendar' && styles.tabBtnActive]}>
          Calendar
        </Text>
      </View>

      {section === 'dashboard' ? (
        <>
          <View style={styles.wardGrid}>
            {wards.map((w) => (
              <View key={w} style={[styles.wardCard, { borderTopColor: wardColors[w] }]}>
                <Text style={styles.wardLabel}>{w}</Text>
                <Text style={styles.wardNum}>{wardStats.find((s) => s.ward === w)?.cnt ?? 0}</Text>
                <Text style={styles.wardCode}>Ward {wardCodes[w]}</Text>
              </View>
            ))}
          </View>

          <WardBreakdownCard wardStats={wardStats} />
          <LeagueBreakdownCard leagueStats={leagueStats} />
          <GenderBreakdownCard genderStats={genderStats} />
          <SacramentsCard sacraments={sacraments} />

          <Card>
            <Text style={styles.cardTitle}>Parish Announcements</Text>
            <Text style={styles.cardSub}>Shown to every member on their portal. Keep this current.</Text>
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
              <Button title="Add Announcement" onPress={addAnnouncement} loading={saving} />
            </View>
            {announcements.map((a) => (
              <View key={a.id} style={styles.annItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.annDate}>{a.date_text}</Text>
                  <Text style={styles.annTitle}>{a.title}</Text>
                  <Text style={styles.annBody}>{a.body}</Text>
                </View>
                <Text style={styles.removeLink} onPress={() => removeAnnouncement(a.id)}>
                  Remove
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          <ChurchCalendarCard />
          <BirthdaysCard birthdays={birthdays} subtitle="Next 30 days, whole congregation" showWard />
        </>
      )}
    </ScrollView>
  )
}
