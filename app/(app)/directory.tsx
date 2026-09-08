import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View } from 'react-native'
import { Chip, GlassSheen } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { colors } from '../../theme'
import { useCongregationData } from '../../lib/congregationContext'
import { styles } from '../../styles/members.styles'
import type { DirectoryEntry } from '../../lib/types'

export { ErrorBoundary } from '../../components/errorBoundary'

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
            <Text style={styles.memberName}>{item.full_name}</Text>
            <View style={styles.memberChips}>
              <Chip label={item.profession} color={colors.g700} />
              {ward ? <Chip label={ward.name} color={ward.color} /> : null}
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
