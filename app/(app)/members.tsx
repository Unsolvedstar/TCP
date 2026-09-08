import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Alert } from '../../lib/alert'
import { Button, Card, Chip, DateField, GlassSheen, SelectField, formatDate } from '../../components/ui'
import { EditMemberModal } from '../../components/editMemberModal'
import { MemberProfileModal } from '../../components/memberProfileModal'
import { EditChildModal } from '../../components/editChildModal'
import { ActivityList } from '../../components/activityList'
import { ChipRow } from '../../components/chipRow'
import { HouseholdCard } from '../../components/householdCard'
import { CollapsibleSection } from '../../components/collapsibleSection'
import { supabase } from '../../lib/supabase'
import { colors, genderColors } from '../../theme'
import { useCongregationData } from '../../lib/congregationContext'
import { applicationDetailText, applicationCertificateList } from '../../lib/applicationDetail'
import { classifyAge, AGE_GROUP_LABELS } from '../../lib/ageGroups'
import { styles } from '../../styles/members.styles'
import type { BaptismApplication, ChildRow, ConfirmationApplication, Household, LeagueApplication, Profile } from '../../lib/types'

const AGE_GROUP_COLORS = { child: '#c1447e', adult: colors.g700, elder: colors.brandNavy } as const

export { ErrorBoundary } from '../../components/errorBoundary'

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

type AutoMergeFlag = {
  id: string
  household_id: string
  household_name: string | null
  profile_id: string
  profile_name: string
  matched_surname: string
  match_type: 'surname_ward' | 'self_selected'
  created_at: string
}

export default function Members() {
  const { wards, leagues } = useCongregationData()
  const [tab, setTab] = useState<'adults' | 'children' | 'families' | 'activity'>('adults')
  const [members, setMembers] = useState<Profile[]>([])
  const [children, setChildren] = useState<ChildRow[]>([])
  const [admins, setAdmins] = useState<Profile[]>([])
  const [leagueAdmins, setLeagueAdmins] = useState<LeagueAdminRow[]>([])
  const [households, setHouseholds] = useState<Household[]>([])
  const [autoMergeFlags, setAutoMergeFlags] = useState<AutoMergeFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [wardFilter, setWardFilter] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [editingMember, setEditingMember] = useState<Profile | null>(null)
  const [viewingMember, setViewingMember] = useState<Profile | null>(null)
  const [editingChild, setEditingChild] = useState<ChildRow | null>(null)
  const [schedulingKey, setSchedulingKey] = useState<string | null>(null)
  const [ceremonyDate, setCeremonyDate] = useState<string | null>(null)
  const [sendingDate, setSendingDate] = useState(false)
  const [familySearch, setFamilySearch] = useState('')
  const [generatingCodes, setGeneratingCodes] = useState(false)

  const loadAll = useCallback(async () => {
    const [{ data: mem, error: memErr }, { data: dep, error: depErr }, { data: adm, error: admErr }, { data: la }, { data: hh }, { data: amf }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'member').order('full_name'),
      supabase.from('dependents').select('*, guardian:profiles(full_name)').order('full_name'),
      supabase.from('profiles').select('*').eq('role', 'admin').order('full_name'),
      supabase.from('league_admins').select('profile_id, league_id, profiles(full_name)'),
      supabase.from('households').select('*').order('name'),
      supabase.rpc('admin_list_auto_merge_flags'),
    ])
    if (!memErr) setMembers((mem as Profile[]) ?? [])
    if (!depErr) setChildren((dep as unknown as ChildRow[]) ?? [])
    if (!admErr) setAdmins((adm as Profile[]) ?? [])
    setLeagueAdmins((la as unknown as LeagueAdminRow[]) ?? [])
    setHouseholds((hh as Household[]) ?? [])
    setAutoMergeFlags((amf as AutoMergeFlag[]) ?? [])
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

  const householdsById = useMemo(() => new Map(households.map((h) => [h.id, h])), [households])
  const familyNameOf = (householdId: string | null) => (householdId ? householdsById.get(householdId)?.name ?? '' : '')
  const matchesSearch = (name: string, householdId: string | null, extra = '') => {
    const q = search.toLowerCase()
    return !q || name.toLowerCase().includes(q) || extra.toLowerCase().includes(q) || familyNameOf(householdId).toLowerCase().includes(q)
  }

  const filteredMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          matchesSearch(m.full_name, m.household_id, [m.phone, m.email, m.profession].filter(Boolean).join(' ')) &&
          (!wardFilter || m.ward_id === wardFilter) &&
          matchesLeagueFilter(m.league_id)
      ),
    [members, search, wardFilter, leagueFilter, householdsById]
  )
  const filteredChildren = useMemo(
    () => children.filter((c) => matchesSearch(c.full_name, c.household_id) && (!wardFilter || c.ward_id === wardFilter) && matchesLeagueFilter(c.league_id)),
    [children, search, wardFilter, leagueFilter, householdsById]
  )

  const householdPeople = useMemo(() => {
    const map = new Map<string, { members: Profile[]; dependents: ChildRow[] }>()
    households.forEach((h) => map.set(h.id, { members: [], dependents: [] }))
    members.forEach((m) => {
      if (m.household_id && map.has(m.household_id)) map.get(m.household_id)!.members.push(m)
    })
    children.forEach((c) => {
      if (c.household_id && map.has(c.household_id)) map.get(c.household_id)!.dependents.push(c)
    })
    return map
  }, [households, members, children])

  const unassignedMembers = useMemo(() => members.filter((m) => !m.household_id), [members])
  const unassignedChildren = useMemo(() => children.filter((c) => !c.household_id), [children])

  const filteredHouseholds = useMemo(() => {
    const q = familySearch.trim().toLowerCase()
    if (!q) return households
    return households.filter((h) => (h.name ?? '').toLowerCase().includes(q) || h.code.toLowerCase().includes(q))
  }, [households, familySearch])

  async function generateCodes() {
    setGeneratingCodes(true)
    const { data, error } = await supabase.rpc('admin_generate_household_codes', { p_count: 20 })
    setGeneratingCodes(false)
    if (error) {
      Alert.alert('Could not generate codes', error.message)
      return
    }
    const codes = ((data as { id: string; code: string }[]) ?? []).map((r) => r.code)
    Alert.alert('20 new family codes', `Hand these out — the first person to register or join with each one starts that family:\n\n${codes.join('   ')}`)
    loadAll()
  }

  async function confirmAutoMerge(flag: AutoMergeFlag) {
    const { error } = await supabase.rpc('admin_confirm_auto_merge', { target_id: flag.id })
    if (error) Alert.alert('Could not confirm', error.message)
    else loadAll()
  }

  function splitAutoMerge(flag: AutoMergeFlag) {
    Alert.alert(
      'Split into a new family',
      `Move ${flag.profile_name} out of "${flag.household_name}" into their own new family? They keep any children already on their record.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Split',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('admin_split_auto_merge', { target_id: flag.id })
            if (error) Alert.alert('Could not split', error.message)
            else loadAll()
          },
        },
      ]
    )
  }

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
              {members.length} member{members.length !== 1 ? 's' : ''}, {children.length} dependent{children.length !== 1 ? 's' : ''}
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
                      {detail || certs.length > 0 ? (
                        <View style={styles.pendingAppRow}>
                          {detail ? <Text style={styles.pendingAppText}>{detail}</Text> : null}
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {certs.map((c) => (
                              <View key={c.label} style={{ alignItems: 'center' }}>
                                <Image source={{ uri: c.uri }} style={styles.pendingSignature} />
                                <Text style={styles.pendingThumbLabel}>{c.label}</Text>
                              </View>
                            ))}
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
                Members ({members.length})
              </Text>
              <Text onPress={() => setTab('children')} style={[styles.tabBtn, tab === 'children' && styles.tabBtnActive]}>
                Dependents ({children.length})
              </Text>
              <Text onPress={() => setTab('families')} style={[styles.tabBtn, tab === 'families' && styles.tabBtnActive]}>
                Families ({households.length})
              </Text>
              <Text onPress={() => setTab('activity')} style={[styles.tabBtn, tab === 'activity' && styles.tabBtnActive]}>
                Activity
              </Text>
            </View>

            {tab === 'activity' ? (
              <ActivityList people={[...members, ...admins]} />
            ) : tab === 'families' ? (
              <View>
                <Card>
                  <Text style={styles.cardTitle}>Family Codes</Text>
                  <Text style={styles.adminHint}>
                    Generate a batch of codes and hand them out. A code is required to register — whoever registers or joins with a fresh code becomes
                    that family's first member, and the family is named after them automatically.
                  </Text>
                  <View style={{ marginTop: 10 }}>
                    <Button title="Generate 20 Codes" variant="secondary" onPress={generateCodes} loading={generatingCodes} />
                  </View>
                </Card>

                {autoMergeFlags.length > 0 && (
                  <Card>
                    <Text style={styles.cardTitle}>Needs Review ({autoMergeFlags.length})</Text>
                    <Text style={styles.adminHint}>
                      Registration matches new members onto an existing family automatically (by surname + ward) or when someone points at a sibling
                      by name — no code needed either way. These were matched that way — confirm they're really the same family, or split the person
                      off into their own new family if not.
                    </Text>
                    {autoMergeFlags.map((f) => (
                      <View key={f.id} style={styles.pendingRow}>
                        <Text style={{ fontSize: 13.5, color: colors.text }}>
                          {f.profile_name} → {f.household_name ?? 'Unnamed family'} (
                          {f.match_type === 'self_selected' ? 'picked as their own sibling' : `matched surname: ${f.matched_surname}`})
                        </Text>
                        <View style={styles.pendingActions}>
                          <Text style={styles.approveBtn} onPress={() => confirmAutoMerge(f)}>Confirm</Text>
                          <Text style={styles.denyBtn} onPress={() => splitAutoMerge(f)}>Split Off</Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                )}

                <Text style={styles.screenSub}>Search to find a family and manage who's in it.</Text>
                <TextInput
                  style={styles.search}
                  value={familySearch}
                  onChangeText={setFamilySearch}
                  placeholder="Search families by name or code…"
                  placeholderTextColor="#a99"
                />

                {filteredHouseholds.map((h) => (
                  <HouseholdCard
                    key={h.id}
                    household={h}
                    members={householdPeople.get(h.id)?.members ?? []}
                    dependents={householdPeople.get(h.id)?.dependents ?? []}
                    onChanged={loadAll}
                  />
                ))}

                {filteredHouseholds.length === 0 && <Text style={styles.emptyText}>No families found.</Text>}

                {(unassignedMembers.length > 0 || unassignedChildren.length > 0) && (
                  <Card>
                    <Text style={styles.cardTitle}>Unassigned ({unassignedMembers.length + unassignedChildren.length})</Text>
                    {unassignedMembers.map((m) => (
                      <View key={m.id} style={[styles.pendingRow, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                        <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>{m.full_name}</Text>
                      </View>
                    ))}
                    {unassignedChildren.map((c) => (
                      <View key={c.id} style={[styles.pendingRow, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                        <Ionicons name="body-outline" size={13} color={colors.muted} />
                        <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>{c.full_name}</Text>
                      </View>
                    ))}
                    <Text style={styles.adminHint}>Assign someone to a family by opening their profile under Members or Dependents.</Text>
                  </Card>
                )}
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.search}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name, phone, email, profession, or family…"
                  placeholderTextColor="#a99"
                />
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

                <CollapsibleSection title={`Admins (${admins.length})`}>
                  {admins.map((a) => (
                    <View key={a.id} style={[styles.pendingRow, { flexDirection: 'row', alignItems: 'center' }]}>
                      <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>{a.full_name}</Text>
                      <Text style={styles.denyBtn} onPress={() => confirmDemoteAdmin(a)}>
                        Remove Access
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.adminHint}>To give someone admin access, open their profile below and tap "Promote to Admin".</Text>
                </CollapsibleSection>

                <CollapsibleSection title="League Admins">
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
                </CollapsibleSection>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isChild = tab === 'children'
          const child = item as ChildRow
          const itemWard = wards.find((w) => w.id === item.ward_id)
          const itemLeague = leagues.find((l) => l.id === item.league_id) ?? NONE_LEAGUE
          // Computed live from date_of_birth, not from which tab/table this
          // row came from — a self-registered member isn't necessarily an
          // adult, and a guardian-managed dependent isn't necessarily a
          // minor, so this can't be inferred from "Members" vs "Dependents".
          const ageGroup = classifyAge(item.date_of_birth)
          const familyName = item.household_id ? householdsById.get(item.household_id)?.name : null
          return (
            <Pressable style={styles.memberCard} onPress={() => (isChild ? setEditingChild(child) : setViewingMember(item as Profile))}>
              <GlassSheen />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{item.full_name}</Text>
                {isChild ? <Text style={styles.guardianLine}>Guardian: {child.guardian?.full_name ?? 'Unknown'}</Text> : null}
                {item.date_of_birth ? <Text style={styles.guardianLine}>{formatDate(item.date_of_birth)}</Text> : null}
                {!isChild
                  ? [(item as Profile).phone, (item as Profile).email, (item as Profile).profession].filter(Boolean).length > 0 && (
                      <Text style={styles.guardianLine}>
                        {[(item as Profile).phone, (item as Profile).email, (item as Profile).profession].filter(Boolean).join('  ·  ')}
                      </Text>
                    )
                  : null}
                <View style={styles.memberChips}>
                  {familyName ? <Chip label={familyName} color={colors.brandNavy} /> : null}
                  {ageGroup ? <Chip label={AGE_GROUP_LABELS[ageGroup]} color={AGE_GROUP_COLORS[ageGroup]} /> : null}
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
        ListEmptyComponent={tab === 'activity' || tab === 'families' ? null : <Text style={styles.emptyText}>No {tab === 'adults' ? 'members' : 'dependents'} found.</Text>}
      />

      {viewingMember && (
        <MemberProfileModal
          member={viewingMember}
          ward={wards.find((w) => w.id === viewingMember.ward_id)}
          league={leagues.find((l) => l.id === viewingMember.league_id)}
          household={viewingMember.household_id ? householdsById.get(viewingMember.household_id) ?? null : null}
          familyMembers={(householdPeople.get(viewingMember.household_id ?? '')?.members ?? []).filter((m) => m.id !== viewingMember.id)}
          familyDependents={householdPeople.get(viewingMember.household_id ?? '')?.dependents ?? []}
          leagueAdminFor={leagues.filter((l) => leagueAdmins.some((la) => la.profile_id === viewingMember.id && la.league_id === l.id))}
          onClose={() => setViewingMember(null)}
          onEdit={() => {
            setEditingMember(viewingMember)
            setViewingMember(null)
          }}
        />
      )}
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          households={households}
          onClose={() => setEditingMember(null)}
          onSaved={() => { setEditingMember(null); loadAll() }}
          onRemoved={() => { setEditingMember(null); confirmRemoveMember(editingMember) }}
          onPromoted={() => { setEditingMember(null); confirmPromoteMember(editingMember) }}
        />
      )}
      {editingChild && (
        <EditChildModal
          child={editingChild}
          households={households}
          onClose={() => setEditingChild(null)}
          onSaved={() => { setEditingChild(null); loadAll() }}
          onRemoved={() => { setEditingChild(null); confirmRemoveChild(editingChild) }}
        />
      )}
    </View>
  )
}
