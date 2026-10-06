import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { WhatsAppButton } from '../../../components/whatsAppButton'
import { openUrlSafely } from '../../../lib/safeLink'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Chip, GlassSheen } from '../../../components/ui'
import { supabase } from '../../../lib/supabase'
import { colors } from '../../../theme'
import { useCongregationData } from '../../../lib/congregationContext'
import { styles } from '../../../styles/members.styles'
import type { DirectoryEntry } from '../../../lib/types'

export { ErrorBoundary } from '../../../components/errorBoundary'

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')
}

export default function Directory() {
  const { wards } = useCongregationData()
  const [entries, setEntries] = useState<DirectoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('congregation_directory')
    setEntries((data as DirectoryEntry[]) ?? [])
    setLoading(false)
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.full_name.toLowerCase().includes(q) || e.profession.toLowerCase().includes(q))
  }, [entries, search])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.g700} size="large" />
      </View>
    )
  }

  return (
    <FlatList
      style={styles.flex}
      data={filtered}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.g700} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.screenTitle}>Directory</Text>
          <Text style={styles.screenSub}>Fellow members who've shared their profession — {entries.length} listed.</Text>
          <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search by name or profession…" placeholderTextColor="#a99" />
        </View>
      }
      renderItem={({ item }) => {
        const ward = wards.find((w) => w.id === item.ward_id)
        return (
          <View style={styles.memberCard}>
            <GlassSheen />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.g50, borderWidth: 1, borderColor: colors.g100, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.g700 }}>{initials(item.full_name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { marginBottom: 0 }]}>{item.full_name}</Text>
                <View style={styles.memberChips}>
                  <Chip label={item.profession} color={colors.g700} />
                  {ward ? <Chip label={ward.name} color={ward.color} /> : null}
                </View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.cream }}>
              <Pressable
                disabled={!item.phone}
                onPress={() => item.phone && openUrlSafely(`tel:${item.phone.replace(/\s/g, '')}`, "This device can't place calls.")}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Ionicons name="call-outline" size={16} color={item.phone ? colors.g700 : colors.muted} />
                <Text style={{ fontSize: 13.5, fontWeight: item.phone ? '700' : '400', color: item.phone ? colors.g700 : colors.muted }}>{item.phone ?? 'No phone on file'}</Text>
              </Pressable>
              <WhatsAppButton phone={item.phone} label="Message" />
            </View>
          </View>
        )
      }}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          {search ? 'No one matches your search.' : "No one's shared a profession yet. Add your own from your portal to be the first."}
        </Text>
      }
    />
  )
}
