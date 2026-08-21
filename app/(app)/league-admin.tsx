import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Alert } from '../../lib/alert'
import { Button, Card, DateField, Field } from '../../components/ui'
import { ChipRow } from '../../components/chip-row'
import { CertificatePicker } from '../../components/certificate-picker'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth-context'
import { useCongregationData } from '../../lib/congregation-context'
import { useLeagueAdmin } from '../../lib/league-admin-context'
import { applicationDetailText, applicationCertificateList } from '../../lib/application-detail'
import { colors } from '../../theme'
import { styles } from '../../styles/members.styles'
import type { Announcement, ChildRow, ChurchEventRow, Profile } from '../../lib/types'

export { ErrorBoundary } from '../../components/error-boundary'

type PendingItem = {
  id: string
  name: string
  isChild: boolean
  guardianName?: string
  application: Profile['league_application']
}

export default function LeagueAdmin() {
  const { profile } = useAuth()
  const { leagues } = useCongregationData()
  const { myLeagueIds } = useLeagueAdmin()
  const [selectedLeagueId, setSelectedLeagueId] = useState(myLeagueIds[0] ?? '')
  const [pendingMembers, setPendingMembers] = useState<Profile[]>([])
  const [pendingChildren, setPendingChildren] = useState<ChildRow[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [events, setEvents] = useState<ChurchEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [annTitle, setAnnTitle] = useState('')
  const [annDateText, setAnnDateText] = useState('')
  const [annBody, setAnnBody] = useState('')
  const [annPoster, setAnnPoster] = useState<string | null>(null)
  const [annAudience, setAnnAudience] = useState<'league' | 'church'>('league')
  const [savingAnn, setSavingAnn] = useState(false)

  const [evTitle, setEvTitle] = useState('')
  const [evDate, setEvDate] = useState<string | null>(null)
  const [evDescription, setEvDescription] = useState('')
  const [evAudience, setEvAudience] = useState<'league' | 'church'>('league')
  const [savingEv, setSavingEv] = useState(false)

  const [schedulingId, setSchedulingId] = useState<string | null>(null)
  const [ceremonyDate, setCeremonyDate] = useState<string | null>(null)
  const [sendingDate, setSendingDate] = useState(false)

  const audienceOptions = [
    { value: 'league', label: 'My League' },
    { value: 'church', label: 'Whole Church' },
  ]

  const isAdmin = profile?.role === 'admin'
  // A congregation admin can already act on every league via is_admin_of()
  // server-side (approve/deny, post, award points) — this just gives them
  // the same tooling league admins use, for oversight, instead of leaving
  // league management invisible to them unless they're also personally
  // assigned as a league admin somewhere.
  const myLeagues = useMemo(() => (isAdmin ? leagues : leagues.filter((l) => myLeagueIds.includes(l.id))), [leagues, myLeagueIds, isAdmin])
  const activeLeagueId = selectedLeagueId || myLeagues[0]?.id || ''

  const loadAll = useCallback(async () => {
    if (!activeLeagueId || !profile) {
      setLoading(false)
      return
    }
    // League admins only see whole-church posts they made themselves here
    // (the main Dashboard/Portal list is where every whole-church post
    // belongs). A congregation admin overseeing everything sees all of them.
    const churchWideFilter = isAdmin ? 'league_id.is.null' : `and(league_id.is.null,created_by.eq.${profile.id})`
    const [{ data: mem }, { data: dep }, { data: ann }, { data: ev }] = await Promise.all([
      supabase.from('profiles').select('*').eq('pending_league_id', activeLeagueId),
      supabase.from('dependents').select('*, guardian:profiles(full_name)').eq('pending_league_id', activeLeagueId),
      supabase.from('announcements').select('*').or(`league_id.eq.${activeLeagueId},${churchWideFilter}`).order('created_at', { ascending: false }),
      supabase.from('events').select('*').or(`league_id.eq.${activeLeagueId},${churchWideFilter}`).order('event_date', { ascending: false }),
    ])
    setPendingMembers((mem as Profile[]) ?? [])
    setPendingChildren((dep as unknown as ChildRow[]) ?? [])
    setAnnouncements((ann as Announcement[]) ?? [])
    setEvents((ev as ChurchEventRow[]) ?? [])
    setLoading(false)
  }, [activeLeagueId, profile, isAdmin])

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

  const pending: PendingItem[] = [
    ...pendingMembers.map((m) => ({ id: m.id, name: m.full_name, isChild: false, application: m.league_application })),
    ...pendingChildren.map((c) => ({ id: c.id, name: c.full_name, isChild: true, guardianName: c.guardian?.full_name ?? 'Unknown guardian', application: c.league_application })),
  ]

  function startScheduling(item: PendingItem) {
    setSchedulingId(item.id)
    setCeremonyDate(null)
  }

  async function sendCeremonyDate(item: PendingItem) {
    if (!ceremonyDate) {
      Alert.alert('Pick a date', 'Please choose a date first.')
      return
    }
    setSendingDate(true)
    const { error } = await supabase.rpc('propose_ceremony_date', {
      target_id: item.id,
      p_is_dependent: item.isChild,
      p_kind: 'league',
      p_ceremony_date: ceremonyDate,
      p_league_id: activeLeagueId,
    })
    setSendingDate(false)
    if (error) {
      Alert.alert('Could not send date', error.message)
      return
    }
    setSchedulingId(null)
    setCeremonyDate(null)
    loadAll()
  }

  async function deny(item: PendingItem) {
    const fn = item.isChild ? 'deny_dependent_league' : 'deny_league'
    const { error } = await supabase.rpc(fn, { target_id: item.id })
    if (error) Alert.alert('Could not update', error.message)
    else loadAll()
  }

  async function addAnnouncement() {
    if (!annTitle.trim() || !profile || !activeLeagueId) {
      Alert.alert('Title required', 'Please enter a title.')
      return
    }
    setSavingAnn(true)
    const { error } = await supabase.from('announcements').insert({
      congregation_id: profile.congregation_id,
      league_id: annAudience === 'church' ? null : activeLeagueId,
      title: annTitle.trim(),
      date_text: annDateText.trim(),
      body: annBody.trim(),
      poster: annPoster,
    })
    setSavingAnn(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setAnnTitle('')
    setAnnDateText('')
    setAnnBody('')
    setAnnPoster(null)
    setAnnAudience('league')
    loadAll()
  }

  async function removeAnnouncement(id: string) {
    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) Alert.alert('Could not remove', error.message)
    else loadAll()
  }

  async function addEvent() {
    if (!evTitle.trim() || !evDate || !profile || !activeLeagueId) {
      Alert.alert('Title and date required', 'Please enter a title and pick a date.')
      return
    }
    setSavingEv(true)
    const { error } = await supabase.from('events').insert({
      congregation_id: profile.congregation_id,
      league_id: evAudience === 'church' ? null : activeLeagueId,
      title: evTitle.trim(),
      event_date: evDate,
      description: evDescription.trim() || null,
    })
    setSavingEv(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setEvTitle('')
    setEvDate(null)
    setEvDescription('')
    setEvAudience('league')
    loadAll()
  }

  async function removeEvent(id: string) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) Alert.alert('Could not remove', error.message)
    else loadAll()
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.g700} size="large" />
      </View>
    )
  }

  if (!activeLeagueId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{isAdmin ? 'No leagues have been set up yet.' : "You don't administer any leagues right now."}</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.g700} />}
    >
      <Text style={styles.screenTitle}>{isAdmin ? 'League Tools' : 'My League'}</Text>
      <Text style={styles.screenSub}>
        {isAdmin ? 'Manage announcements, events, and join requests for any league — oversight view.' : 'Manage announcements, events, and join requests for your league.'}
      </Text>

      {myLeagues.length > 1 ? (
        <View style={{ marginBottom: 16 }}>
          <ChipRow options={myLeagues.map((l) => ({ value: l.id, label: l.label, color: l.color }))} value={activeLeagueId} onChange={setSelectedLeagueId} allowDeselect={false} />
        </View>
      ) : null}

      {pending.length > 0 && (
        <Card>
          <Text style={styles.cardTitle}>Pending Join Requests</Text>
          {pending.map((p) => {
            const detail = applicationDetailText('league', p.application)
            const certs = applicationCertificateList(p.application)
            const isScheduling = schedulingId === p.id
            return (
              <View key={p.id} style={styles.pendingRow}>
                <View style={{ flexDirection: 'row' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={styles.pendingName}>{p.name}</Text>
                      {p.isChild ? <Ionicons name="body-outline" size={13} color={colors.muted} /> : null}
                    </View>
                    {p.isChild ? <Text style={styles.pendingDetail}>Guardian: {p.guardianName}</Text> : null}
                  </View>
                  {isScheduling ? null : (
                    <View style={styles.pendingActions}>
                      <Text style={styles.approveBtn} onPress={() => startScheduling(p)}>
                        Schedule
                      </Text>
                      <Text style={styles.denyBtn} onPress={() => deny(p)}>
                        Deny
                      </Text>
                    </View>
                  )}
                </View>
                {detail || certs.length > 0 ? (
                  <View style={styles.pendingAppRow}>
                    {detail ? <Text style={styles.pendingAppText}>{detail}</Text> : null}
                  </View>
                ) : null}
                {isScheduling ? (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    <Text style={styles.pendingAppText}>
                      Pick an installation date — {p.name} will need to confirm it works before it's final.
                    </Text>
                    <DateField label="Installation date" value={ceremonyDate} onChange={setCeremonyDate} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Button title="Send Date" onPress={() => sendCeremonyDate(p)} loading={sendingDate} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button title="Cancel" variant="secondary" onPress={() => setSchedulingId(null)} disabled={sendingDate} />
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            )
          })}
        </Card>
      )}

      <Card>
        <Text style={styles.cardTitle}>Post an Announcement</Text>
        <View style={{ gap: 10 }}>
          <ChipRow label="Who should see this?" options={audienceOptions} value={annAudience} onChange={(v) => setAnnAudience(v as 'league' | 'church')} allowDeselect={false} />
          <Field label="Title" value={annTitle} onChangeText={setAnnTitle} placeholder="e.g. Bible study this Friday" />
          <Field label="Date / when (optional)" value={annDateText} onChangeText={setAnnDateText} placeholder="e.g. 18 October 2026" />
          <Field label="Details (optional)" value={annBody} onChangeText={setAnnBody} placeholder="Short description…" />
          <CertificatePicker label="Poster (optional)" value={annPoster} onChange={setAnnPoster} />
          <Button title="Post Announcement" onPress={addAnnouncement} loading={savingAnn} />
        </View>
        {announcements.map((a) => (
          <View key={a.id} style={styles.pendingRow}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingDetail}>
                  {a.date_text} {a.league_id ? '' : '· Whole Church'}
                </Text>
                <Text style={styles.pendingName}>{a.title}</Text>
                {a.poster ? <Image source={{ uri: a.poster }} style={{ width: '100%', height: 140, borderRadius: 10, marginTop: 6, backgroundColor: colors.cream }} resizeMode="cover" /> : null}
                <Text style={styles.pendingDetail}>{a.body}</Text>
              </View>
              <Text style={styles.denyBtn} onPress={() => removeAnnouncement(a.id)}>
                Remove
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Post an Event</Text>
        <View style={{ gap: 10 }}>
          <ChipRow label="Who should see this?" options={audienceOptions} value={evAudience} onChange={(v) => setEvAudience(v as 'league' | 'church')} allowDeselect={false} />
          <Field label="Title" value={evTitle} onChangeText={setEvTitle} placeholder="e.g. Youth camp" />
          <DateField label="Date" value={evDate} onChange={setEvDate} />
          <Field label="Details (optional)" value={evDescription} onChangeText={setEvDescription} placeholder="Short description…" />
          <Button title="Post Event" onPress={addEvent} loading={savingEv} />
        </View>
        {events.map((e) => (
          <View key={e.id} style={styles.pendingRow}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingDetail}>
                  {e.event_date} {e.league_id ? '' : '· Whole Church'}
                </Text>
                <Text style={styles.pendingName}>{e.title}</Text>
                {e.description ? <Text style={styles.pendingDetail}>{e.description}</Text> : null}
              </View>
              <Text style={styles.denyBtn} onPress={() => removeEvent(e.id)}>
                Remove
              </Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}
