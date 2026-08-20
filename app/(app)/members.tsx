import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, Alert, FlatList, Image, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { Card, Chip, SelectField, formatDate } from '../../components/ui'
import { EditMemberModal } from '../../components/edit-member-modal'
import { EditChildModal } from '../../components/edit-child-modal'
import { supabase } from '../../lib/supabase'
import { colors, genderColors, leagueKeys, leagues, wardColors, wards } from '../../theme'
import { styles } from './members.styles'
import type { BaptismApplication, ChildRow, ConfirmationApplication, LeagueApplication, Profile } from '../../lib/types'

export { ErrorBoundary } from '../../components/error-boundary'

type PendingItem = {
  id: string
  name: string
  ward: string
  type: 'league' | 'baptism' | 'confirmation'
  label: string
  isChild: boolean
  guardianName?: string
  application: LeagueApplication | BaptismApplication | ConfirmationApplication | null
}

function applicationDetail(p: PendingItem): string | null {
  if (!p.application) return null
  const parts: (string | null | undefined)[] =
    p.type === 'league'
      ? [(p.application as LeagueApplication).reason ? `Reason: ${(p.application as LeagueApplication).reason}` : null]
      : p.type === 'baptism'
        ? [
            (p.application as BaptismApplication).type,
            (p.application as BaptismApplication).sponsor_name ? `Sponsor: ${(p.application as BaptismApplication).sponsor_name}` : null,
            (p.application as BaptismApplication).note ? `Note: ${(p.application as BaptismApplication).note}` : null,
          ]
        : [
            (p.application as ConfirmationApplication).mentor_name ? `Mentor: ${(p.application as ConfirmationApplication).mentor_name}` : null,
            (p.application as ConfirmationApplication).note ? `Note: ${(p.application as ConfirmationApplication).note}` : null,
          ]
  const text = parts.filter(Boolean).join(' · ')
  return text || null
}

function applicationCertificates(p: PendingItem): { label: string; uri: string }[] {
  if (!p.application) return []
  const out: { label: string; uri: string }[] = []
  const app = p.application as LeagueApplication & ConfirmationApplication
  if (app.baptism_certificate) out.push({ label: 'Baptism Cert.', uri: app.baptism_certificate })
  if (app.confirmation_certificate) out.push({ label: 'Confirmation Cert.', uri: app.confirmation_certificate })
  return out
}

export default function Members() {
  const [tab, setTab] = useState<'adults' | 'children'>('adults')
  const [members, setMembers] = useState<Profile[]>([])
  const [children, setChildren] = useState<ChildRow[]>([])
  const [admins, setAdmins] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [wardFilter, setWardFilter] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')
  const [editingMember, setEditingMember] = useState<Profile | null>(null)
  const [editingChild, setEditingChild] = useState<ChildRow | null>(null)

  const loadAll = useCallback(async () => {
    const [{ data: mem, error: memErr }, { data: dep, error: depErr }, { data: adm, error: admErr }] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'member').order('full_name'),
      supabase.from('dependents').select('*, guardian:profiles(full_name)').order('full_name'),
      supabase.from('profiles').select('*').eq('role', 'admin').order('full_name'),
    ])
    if (!memErr) setMembers((mem as Profile[]) ?? [])
    if (!depErr) setChildren((dep as unknown as ChildRow[]) ?? [])
    if (!admErr) setAdmins((adm as Profile[]) ?? [])
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
    const items: PendingItem[] = []
    members.forEach((m) => {
      if (m.pending_league)
        items.push({ id: m.id, name: m.full_name, ward: m.ward, type: 'league', label: `Wants to join ${leagues[m.pending_league].label}`, isChild: false, application: m.league_application })
      if (m.pending_baptism)
        items.push({ id: m.id, name: m.full_name, ward: m.ward, type: 'baptism', label: 'Requesting Baptism', isChild: false, application: m.baptism_application })
      if (m.pending_confirmation)
        items.push({ id: m.id, name: m.full_name, ward: m.ward, type: 'confirmation', label: 'Requesting Confirmation', isChild: false, application: m.confirmation_application })
    })
    children.forEach((c) => {
      const guardianName = c.guardian?.full_name ?? 'Unknown guardian'
      if (c.pending_league)
        items.push({ id: c.id, name: c.full_name, ward: c.ward, type: 'league', label: `Wants to join ${leagues[c.pending_league].label}`, isChild: true, guardianName, application: c.league_application })
      if (c.pending_baptism)
        items.push({ id: c.id, name: c.full_name, ward: c.ward, type: 'baptism', label: 'Requesting Baptism', isChild: true, guardianName, application: c.baptism_application })
      if (c.pending_confirmation)
        items.push({ id: c.id, name: c.full_name, ward: c.ward, type: 'confirmation', label: 'Requesting Confirmation', isChild: true, guardianName, application: c.confirmation_application })
    })
    return items
  }, [members, children])

  const filteredMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          (m.full_name.toLowerCase().includes(search.toLowerCase()) || (m.phone ?? '').toLowerCase().includes(search.toLowerCase())) &&
          (!wardFilter || m.ward === wardFilter) &&
          (!leagueFilter || m.league === leagueFilter)
      ),
    [members, search, wardFilter, leagueFilter]
  )
  const filteredChildren = useMemo(
    () => children.filter((c) => c.full_name.toLowerCase().includes(search.toLowerCase()) && (!wardFilter || c.ward === wardFilter) && (!leagueFilter || c.league === leagueFilter)),
    [children, search, wardFilter, leagueFilter]
  )

  async function approve(item: PendingItem) {
    const prefix = item.isChild ? 'approve_dependent_' : 'approve_'
    const fn = `${prefix}${item.type}`
    const { error } = await supabase.rpc(fn, { target_id: item.id })
    if (error) Alert.alert('Could not approve', error.message)
    else loadAll()
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
    Alert.alert('Promote to Admin', `Give ${m.full_name} full admin access — they'll be able to see, edit, approve, and remove every member?`, [
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

  const data: (Profile | ChildRow)[] = tab === 'adults' ? filteredMembers : filteredChildren

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
              {members.length} adult{members.length !== 1 ? 's' : ''} · {children.length} child{children.length !== 1 ? 'ren' : ''}
            </Text>

            {pending.length > 0 && (
              <Card>
                <Text style={styles.cardTitle}>Pending Requests</Text>
                {pending.map((p, i) => {
                  const detail = applicationDetail(p)
                  const certs = applicationCertificates(p)
                  return (
                    <View key={`${p.id}-${p.type}-${i}`} style={styles.pendingRow}>
                      <View style={{ flexDirection: 'row' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pendingName}>
                            {p.name} {p.isChild ? '👶' : ''}
                          </Text>
                          <Text style={styles.pendingDetail}>
                            {p.ward} Ward · {p.label}
                            {p.isChild ? ` · Guardian: ${p.guardianName}` : ''}
                          </Text>
                        </View>
                        <View style={styles.pendingActions}>
                          <Text style={styles.approveBtn} onPress={() => approve(p)}>
                            Approve
                          </Text>
                          <Text style={styles.denyBtn} onPress={() => deny(p)}>
                            Deny
                          </Text>
                        </View>
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
            </View>

            <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by name or phone…" placeholderTextColor="#a99" />
            <View style={styles.filterRow}>
              <ScrollFilterChip label="All Wards" active={!wardFilter} onPress={() => setWardFilter('')} />
              {wards.map((w) => (
                <ScrollFilterChip key={w} label={w} active={wardFilter === w} onPress={() => setWardFilter(w)} />
              ))}
            </View>
            <View style={{ marginBottom: 16 }}>
              <SelectField
                label="Filter by League / Organisation"
                value={leagueFilter}
                onChange={setLeagueFilter}
                placeholder="All leagues & organisations"
                options={[{ value: '', label: 'All leagues & organisations' }, ...leagueKeys.map((k) => ({ value: k, label: leagues[k].label }))]}
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
          </View>
        }
        renderItem={({ item }) => {
          const isChild = tab === 'children'
          const child = item as ChildRow
          return (
            <Pressable style={styles.memberCard} onPress={() => (isChild ? setEditingChild(child) : setEditingMember(item as Profile))}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{item.full_name}</Text>
                {isChild ? <Text style={styles.guardianLine}>Guardian: {child.guardian?.full_name ?? 'Unknown'}</Text> : null}
                {item.date_of_birth ? <Text style={styles.guardianLine}>{formatDate(item.date_of_birth)}</Text> : null}
                <View style={styles.memberChips}>
                  <Chip label={item.ward} color={wardColors[item.ward]} />
                  {item.gender ? <Chip label={item.gender} color={genderColors[item.gender]} /> : null}
                  <Chip label={leagues[item.league].label} color={leagues[item.league].color} />
                  <Chip label={item.baptised ? 'Baptised' : 'Not Baptised'} color={item.baptised ? colors.g700 : colors.muted} />
                  <Chip label={item.confirmed ? 'Confirmed' : 'Not Confirmed'} color={item.confirmed ? colors.g700 : colors.muted} />
                </View>
              </View>
            </Pressable>
          )
        }}
        ListEmptyComponent={<Text style={styles.emptyText}>No {tab === 'adults' ? 'members' : 'children'} found.</Text>}
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

function ScrollFilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      {label}
    </Text>
  )
}
