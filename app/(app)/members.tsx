import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Alert } from '../../lib/alert'
import { Button, Card, Chip, DateField, GlassSheen, SelectField, formatDate } from '../../components/ui'
import { EditMemberModal } from '../../components/edit-member-modal'
import { EditChildModal } from '../../components/edit-child-modal'
import { ActivityList } from '../../components/activity-list'
import { ChipRow } from '../../components/chip-row'
import { supabase } from '../../lib/supabase'
import { colors, genderColors } from '../../theme'
import { useCongregationData } from '../../lib/congregation-context'
import { applicationDetailText, applicationCertificateList } from '../../lib/application-detail'
import { styles } from '../../styles/members.styles'
import type { BaptismApplication, ChildRow, ConfirmationApplication, LeagueApplication, Profile } from '../../lib/types'

export { ErrorBoundary } from '../../components/error-boundary'

const NONE_LEAGUE = { id: '', key: 'None', label: 'No League / Organisation', color: '#9e9e9e' }
// Distinct from '' (the "All leagues" filter sentinel) so the filter can
// still isolate members with no league at all.
const NO_LEAGUE_FILTER = '__none__'

type PendingItem = {
  id: string
  name: string
  ward_id: string
  type: 'league' | 'baptism' | 'confirmation'
  label: string
  isChild: boolean
  guardianName?: string
  application: LeagueApplication | BaptismApplication | ConfirmationApplication | null
  leagueId?: string
}

type LeagueAdminRow = { profile_id: string; league_id: string; profiles: { full_name: string } | null }

export default function Members() {
  const { wards, leagues } = useCongregationData()
  const [tab, setTab] = useState<'adults' | 'children' | 'activity'>('adults')
  const [members, setMembers] = useState<Profile[]>([])
  const [children, setChildren] = useState<ChildRow[]>([])
  const [admins, setAdmins] = useState<Profile[]>([])
  const [leagueAdmins, setLeagueAdmins] = useState<LeagueAdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [wardFilter, setWardFilter] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [editingMember, setEditingMember] = useState<Profile | null>(null)
  const [editingChild, setEditingChild] = useState<ChildRow | null>(null)
  const [schedulingKey, setSchedulingKey] = useState<string | null>(null)
  const [ceremonyDate, setCeremonyDate] = useState<string | null>(null)
  const [sendingDate, setSendingDate] = useState(false)

  const loadAll = useCallback(async () => {
    const [{ data: mem, error: memErr }, { data: dep, error: depErr }, { data: adm, error: admErr }, { data: la }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'member').order('full_name'),
      supabase.from('dependents').select('*, guardian:profiles(full_name)').order('full_name'),
      supabase.from('profiles').select('*').eq('role', 'admin').order('full_name'),
      supabase.from('league_admins').select('profile_id, league_id, profiles(full_name)'),
    ])
    if (!memErr) setMembers((mem as Profile[]) ?? [])
    if (!depErr) setChildren((dep as unknown as ChildRow[]) ?? [])
    if (!admErr) setAdmins((adm as Profile[]) ?? [])
    setLeagueAdmins((la as unknown as LeagueAdminRow[]) ?? [])
    setLoading(false)
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

  const pending = useMemo<PendingItem[]>(() => {
    const leagueLabel = (id: string | null) => (leagues.find((l) => l.id === id) ?? NONE_LEAGUE).label
    const items: PendingItem[] = []
    members.forEach((m) => {
      if (m.pending_league_id)
        items.push({
          id: m.id, name: m.full_name, ward_id: m.ward_id, type: 'league', label: `Wants to join ${leagueLabel(m.pending_league_id)}`,
          isChild: false, application: m.league_application, leagueId: m.pending_league_id,
        })
      if (m.pending_baptism)
        items.push({ id: m.id, name: m.full_name, ward_id: m.ward_id, type: 'baptism', label: 'Requesting Baptism', isChild: false, application: m.baptism_application })
      if (m.pending_confirmation)
        items.push({ id: m.id, name: m.full_name, ward_id: m.ward_id, type: 'confirmation', label: 'Requesting Confirmation', isChild: false, application: m.confirmation_application })
    })
    children.forEach((c) => {
      const guardianName = c.guardian?.full_name ?? 'Unknown guardian'
      if (c.pending_league_id)
        items.push({
          id: c.id, name: c.full_name, ward_id: c.ward_id, type: 'league', label: `Wants to join ${leagueLabel(c.pending_league_id)}`,
          isChild: true, guardianName, application: c.league_application, leagueId: c.pending_league_id,
        })
      if (c.pending_baptism)
        items.push({ id: c.id, name: c.full_name, ward_id: c.ward_id, type: 'baptism', label: 'Requesting Baptism', isChild: true, guardianName, application: c.baptism_application })
      if (c.pending_confirmation)
        items.push({ id: c.id, name: c.full_name, ward_id: c.ward_id, type: 'confirmation', label: 'Requesting Confirmation', isChild: true, guardianName, application: c.confirmation_application })
    })
    return items
  }, [members, children, leagues])

  const leagueAdminsByLeague = useMemo(() => {
    const map = new Map<string, { profileId: string; name: string }[]>()
    leagueAdmins.forEach((r) => {
      const arr = map.get(r.league_id) ?? []
      arr.push({ profileId: r.profile_id, name: r.profiles?.full_name ?? 'Unknown' })
      map.set(r.league_id, arr)
    })
    return map
  }, [leagueAdmins])

  async function revokeLeagueAdmin(profileId: string, leagueId: string, leagueLabel: string, name: string) {
    Alert.alert('Remove league admin', `Remove ${name} as admin of ${leagueLabel}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_set_league_admin', { target_profile_id: profileId, target_league_id: leagueId, make_admin: false })
        if (error) Alert.alert('Could not remove', error.message)
        else loadAll()
      } },
    ])
  }

  const matchesLeagueFilter = (leagueId: string | null) =>
    !leagueFilter || (leagueFilter === NO_LEAGUE_FILTER ? leagueId === null : leagueId === leagueFilter)

  const filteredMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          (m.full_name.toLowerCase().includes(search.toLowerCase()) || (m.phone ?? '').toLowerCase().includes(search.toLowerCase())) &&
          (!wardFilter || m.ward_id === wardFilter) &&
          matchesLeagueFilter(m.league_id)
      ),
    [members, search, wardFilter, leagueFilter]
  )
  const filteredChildren = useMemo(
    () => children.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()) && (!wardFilter || c.ward_id === wardFilter) && matchesLeagueFilter(c.league_id)),
    [children, search, wardFilter, leagueFilter]
  )

  function pendingKey(item: PendingItem) {
    return `${item.id}-${item.type}`
  }

  function startScheduling(item: PendingItem) {
    setSchedulingKey(pendingKey(item))
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
      p_kind: item.type,
      p_ceremony_date: ceremonyDate,
      p_league_id: item.leagueId ?? null,
    })
    setSendingDate(false)
    if (error) {
      Alert.alert('Could not send date', error.message)
      return
    }
    setSchedulingKey(null)
    setCeremonyDate(null)
    loadAll()
  }

  async function deny(item: PendingItem) {
    const prefix = item.isChild ? 'deny_dependent_' : 'deny_'
    const fn = `${prefix}${item.type}`
    const { error } = await supabase.rpc(fn, { target_id: item.id })
    if (error) Alert.alert('Could not update', error.message)
    else loadAll()
  }

  function confirmRemoveMember(m: Profile) {
    const theirKids = children.filter((c) => c.guardian_id === m.id)
    const message =
      theirKids.length > 0
        ? `Remove ${m.full_name} from the registry? This will also permanently remove ${theirKids.length === 1 ? 'their child' : `all ${theirKids.length} of their children`} (${theirKids.map((c) => c.full_name).join(', ')}) from the household registry, since children are registered under a guardian. This cannot be undone.`
        : `Remove ${m.full_name} from the registry? This cannot be undone.`
    Alert.alert('Remove member', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_remove_member', { target_id: m.id })
        if (error) Alert.alert('Could not remove', error.message)
        else loadAll()
      } },
    ])
  }

  function confirmPromoteMember(m: Profile) {
    Alert.alert('Promote to Admin', `Give ${m.full_name} full admin access? They'll be able to see, edit, approve, and remove every member.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Promote', onPress: async () => {
        const { error } = await supabase.rpc('admin_set_role', { target_id: m.id, new_role: 'admin' })
        if (error) Alert.alert('Could not promote', error.message)
        else loadAll()
      } },
    ])
  }

  function confirmDemoteAdmin(a: Profile) {
    Alert.alert('Remove Admin Access', `Remove admin access from ${a.full_name}? They'll go back to being a regular member.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove Access', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_set_role', { target_id: a.id, new_role: 'member' })
        if (error) Alert.alert('Could not update', error.message)
        else loadAll()
      } },
    ])
  }
  function confirmRemoveChild(c: ChildRow) {
    Alert.alert('Remove child', `Remove ${c.full_name} from the household registry? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_remove_dependent', { target_id: c.id })
        if (error) Alert.alert('Could not remove', error.message)
        else loadAll()
      } },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.g700} size="large" />
      </View>
    )
  }

  const data: (Profile | ChildRow)[] = tab === 'adults' ? filteredMembers : tab === 'children' ? filteredChildren : []

  return (
    <View style={styles.flex}>
      <FlatList
        data={data}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.g700} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.screenTitle}>Congregation Registry</Text>
            <Text style={styles.screenSub}>
              {members.length} adult{members.length !== 1 ? 's' : ''}, {children.length} child{children.length !== 1 ? 'ren' : ''}
            </Text>

            {pending.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>Pending Requests</Text>
                {pending.map((p, i) => {
                  const detail = applicationDetailText(p.type, p.application)
                  const certs = applicationCertificateList(p.application)
                  const isScheduling = schedulingKey === pendingKey(p)
                  return (
                    <View key={`${p.id}-${p.type}-${i}`} style={styles.pendingRow}>
                      <View style={{ flexDirection: 'row' }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={styles.pendingName}>{p.name}</Text>
                            {p.isChild ? <Ionicons name="body-outline" size={13} color={colors.muted} /> : null}
                          </View>
                          <Text style={styles.pendingDetail}>
                            {wards.find((w) => w.id === p.ward_id)?.name ?? 'Unknown'} Ward, {p.label}
                            {p.isChild ? ` (Guardian: ${p.guardianName})` : ''}
                          </Text>
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
                      {detail || p.application?.signature || certs.length > 0 ? (
                        <View style={styles.pendingAppRow}>
                          {detail ? <Text style={styles.pendingAppText}>{detail}</Text> : null}
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {certs.map((c) => (
                              <View key={c.label} style={{ alignItems: 'center' }}>
                                <Image source={{ uri: c.uri }} style={styles.pendingSignature} />
                                <Text style={styles.pendingThumbLabel}>{c.label}</Text>
                              </View>
                            ))}
                            {p.application?.signature ? (
                              <View style={{ alignItems: 'center' }}>
                                <Image source={{ uri: p.application.signature }} style={styles.pendingSignature} />
                                <Text style={styles.pendingThumbLabel}>Signature</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                      {isScheduling ? (
                        <View style={{ gap: 8, marginTop: 8 }}>
                          <Text style={styles.pendingAppText}>
                            Pick a date for {p.type === 'league' ? `their ${leagues.find((l) => l.id === p.leagueId)?.label ?? 'league'} installation` : `the ${p.type}`} —
                            {p.name} will need to confirm it works before it's final.
                          </Text>
                          <DateField label="Ceremony date" value={ceremonyDate} onChange={setCeremonyDate} />
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                              <Button title="Send Date" onPress={() => sendCeremonyDate(p)} loading={sendingDate} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Button title="Cancel" variant="secondary" onPress={() => setSchedulingKey(null)} disabled={sendingDate} />
                            </View>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </Card>
            )}

            <View style={styles.tabRow}>
              <Text onPress={() => setTab('adults')} style={[styles.tabBtn, tab === 'adults' && styles.tabBtnActive]}>
                Adults ({members.length})
              </Text>
              <Text onPress={() => setTab('children')} style={[styles.tabBtn, tab === 'children' && styles.tabBtnActive]}>
                Children ({children.length})
              </Text>
              <Text onPress={() => setTab('activity')} style={[styles.tabBtn, tab === 'activity' && styles.tabBtnActive]}>
                Activity
              </Text>
            </View>

            {tab === 'activity' ? (
              <ActivityList people={[...members, ...admins]} />
            ) : (
              <>
                <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by name or phone…" placeholderTextColor="#a99" />
                <View style={{ marginBottom: 16 }}>
                  <ChipRow
                    options={[{ value: '', label: 'All Wards' }, ...wards.map((w) => ({ value: w.id, label: w.name, color: w.color }))]}
                    value={wardFilter}
                    onChange={setWardFilter}
                  />
                </View>
                <View style={{ marginBottom: 16 }}>
                  <SelectField
                    label="Filter by League / Organisation"
                    value={leagueFilter}
                    onChange={setLeagueFilter}
                    placeholder="All leagues & organisations"
                    options={[
                      { value: '', label: 'All leagues & organisations' },
                      { value: NO_LEAGUE_FILTER, label: 'No League / Organisation' },
                      ...leagues.map((l) => ({ value: l.id, label: l.label })),
                    ]}
                  />
                </View>

                <Card>
                  <Text style={styles.cardTitle}>Admins ({admins.length})</Text>
                  {admins.map((a) => (
                    <View key={a.id} style={[styles.pendingRow, { flexDirection: 'row', alignItems: 'center' }]}>
                      <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>{a.full_name}</Text>
                      <Text style={styles.denyBtn} onPress={() => confirmDemoteAdmin(a)}>
                        Remove Access
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.adminHint}>To give someone admin access, open their profile below and tap "Promote to Admin".</Text>
                </Card>

                <Card>
                  <Text style={styles.cardTitle}>League Admins</Text>
                  {leagues.map((l) => {
                    const assigned = leagueAdminsByLeague.get(l.id) ?? []
                    return (
                      <View key={l.id} style={styles.pendingRow}>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: l.color, marginBottom: 4 }}>{l.label}</Text>
                        {assigned.length === 0 ? (
                          <Text style={{ fontSize: 12, color: colors.muted, fontStyle: 'italic' }}>No league admin assigned</Text>
                        ) : (
                          assigned.map((a) => (
                            <View key={a.profileId} style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ flex: 1, fontSize: 13, color: colors.text }}>{a.name}</Text>
                              <Text style={styles.denyBtn} onPress={() => revokeLeagueAdmin(a.profileId, l.id, l.label, a.name)}>
                                Remove
                              </Text>
                            </View>
                          ))
                        )}
                      </View>
                    )
                  })}
                  <Text style={styles.adminHint}>To make someone a league admin, open their profile below and choose leagues under "League admin access".</Text>
                </Card>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isChild = tab === 'children'
          const child = item as ChildRow
          const itemWard = wards.find((w) => w.id === item.ward_id)
          const itemLeague = leagues.find((l) => l.id === item.league_id) ?? NONE_LEAGUE
          return (
            <Pressable style={styles.memberCard} onPress={() => (isChild ? setEditingChild(child) : setEditingMember(item as Profile))}>
              <GlassSheen />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{item.full_name}</Text>
                {isChild ? <Text style={styles.guardianLine}>Guardian: {child.guardian?.full_name ?? 'Unknown'}</Text> : null}
                {item.date_of_birth ? <Text style={styles.guardianLine}>{formatDate(item.date_of_birth)}</Text> : null}
                <View style={styles.memberChips}>
                  {itemWard ? <Chip label={itemWard.name} color={itemWard.color} /> : null}
                  {item.gender ? <Chip label={item.gender} color={genderColors[item.gender]} /> : null}
                  <Chip label={itemLeague.label} color={itemLeague.color} />
                  <Chip label={item.baptised ? 'Baptised' : 'Not Baptised'} color={item.baptised ? colors.g700 : colors.muted} />
                  <Chip label={item.confirmed ? 'Confirmed' : 'Not Confirmed'} color={item.confirmed ? colors.g700 : colors.muted} />
                </View>
              </View>
            </Pressable>
          )
        }}
        ListEmptyComponent={tab === 'activity' ? null : <Text style={styles.emptyText}>No {tab === 'adults' ? 'members' : 'children'} found.</Text>}
      />

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={() => { setEditingMember(null); loadAll() }}
          onRemoved={() => { setEditingMember(null); confirmRemoveMember(editingMember) }}
          onPromoted={() => { setEditingMember(null); confirmPromoteMember(editingMember) }}
        />
      )}
      {editingChild && (
        <EditChildModal
          child={editingChild}
          onClose={() => setEditingChild(null)}
          onSaved={() => { setEditingChild(null); loadAll() }}
          onRemoved={() => { setEditingChild(null); confirmRemoveChild(editingChild) }}
        />
      )}
    </View>
  )
}
