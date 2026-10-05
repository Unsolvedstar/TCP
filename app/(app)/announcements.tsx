import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Alert } from '../../lib/alert'
import { Button, Card, Field } from '../../components/ui'
import { ChipRow } from '../../components/chipRow'
import { CertificatePicker } from '../../components/certificatePicker'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/authContext'
import { useCongregationData } from '../../lib/congregationContext'
import { useLeagueAdmin } from '../../lib/leagueAdminContext'
import { colors } from '../../theme'
import { styles } from '../../styles/members.styles'
import type { Announcement } from '../../lib/types'

export { ErrorBoundary } from '../../components/errorBoundary'

// The one place announcements are posted and managed. Congregation admins can
// post to the whole church or any league; league admins to their own league(s)
// or the whole church. Members only read them, on their portal.
export default function Announcements() {
  const { profile } = useAuth()
  const { leagues } = useCongregationData()
  const { myLeagueIds } = useLeagueAdmin()
  const isAdmin = profile?.role === 'admin'

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [audience, setAudience] = useState<string>('church')
  const [title, setTitle] = useState('')
  const [dateText, setDateText] = useState('')
  const [body, setBody] = useState('')
  const [poster, setPoster] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const postableLeagues = useMemo(() => (isAdmin ? leagues : leagues.filter((l) => myLeagueIds.includes(l.id))), [leagues, myLeagueIds, isAdmin])
  const audienceOptions = [
    { value: 'church', label: 'Whole Church' },
    ...postableLeagues.map((l) => ({ value: l.id, label: l.label, color: l.color })),
  ]

  const loadAll = useCallback(async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    const all = (data as Announcement[]) ?? []
    // League admins manage only their leagues' posts and their own church-wide ones.
    setAnnouncements(
      isAdmin ? all : all.filter((a) => (a.league_id ? myLeagueIds.includes(a.league_id) : a.created_by === profile?.id))
    )
    setLoading(false)
  }, [isAdmin, myLeagueIds, profile?.id])

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
    const { error } = await supabase.from('announcements').insert({
      congregation_id: profile.congregation_id,
      league_id: audience === 'church' ? null : audience,
      title: title.trim(),
      date_text: dateText.trim(),
      body: body.trim(),
      poster,
    })
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.g700} size="large" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.g700} />}
    >
      <Text style={styles.screenTitle}>Announcements</Text>
      <Text style={styles.screenSub}>
        {isAdmin ? 'Post to the whole church or a single league, and manage everything already posted.' : 'Post to your league or the whole church.'}
      </Text>

      <Card>
        <Text style={styles.cardTitle}>New Announcement</Text>
        <View style={{ gap: 10 }}>
          <ChipRow label="Who should see this?" options={audienceOptions} value={audience} onChange={setAudience} allowDeselect={false} />
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Harvest Celebration" />
          <Field label="Date / when (optional)" value={dateText} onChangeText={setDateText} placeholder="e.g. 18 October 2026" />
          <Field label="Details (optional)" value={body} onChangeText={setBody} placeholder="Short description…" />
          <CertificatePicker label="Poster (optional)" value={poster} onChange={setPoster} />
          <Button title="Post Announcement" onPress={addAnnouncement} loading={saving} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Posted ({announcements.length})</Text>
        {announcements.length === 0 ? <Text style={styles.pendingDetail}>Nothing posted yet.</Text> : null}
        {announcements.map((a) => {
          const league = a.league_id ? leagues.find((l) => l.id === a.league_id) : null
          return (
            <View key={a.id} style={styles.pendingRow}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.pendingDetail}>
                    {a.date_text ? `${a.date_text} · ` : ''}
                    {league ? league.label : 'Whole Church'}
                  </Text>
                  <Text style={styles.pendingName}>{a.title}</Text>
                  {a.poster ? <Image source={{ uri: a.poster }} style={{ width: '100%', height: 140, borderRadius: 10, marginTop: 6, backgroundColor: colors.cream }} resizeMode="cover" /> : null}
                  {a.body ? <Text style={styles.pendingDetail}>{a.body}</Text> : null}
                </View>
                <Text style={styles.denyBtn} onPress={() => removeAnnouncement(a.id)}>
                  Remove
                </Text>
              </View>
            </View>
          )
        })}
      </Card>
    </ScrollView>
  )
}
