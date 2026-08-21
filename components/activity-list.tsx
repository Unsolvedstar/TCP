import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { Card, Chip } from './ui'
import { styles } from '../styles/members.styles'
import { colors } from '../theme'
import type { Profile } from '../lib/types'

type ActivityFilter = 'all' | '60' | '90' | 'never' | 'left'

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ms = Date.now() - new Date(iso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function staleness(days: number | null): { label: string; color: string } {
  if (days === null) return { label: 'Never logged in', color: colors.danger }
  if (days >= 90) return { label: `${days} days ago`, color: colors.danger }
  if (days >= 30) return { label: `${days} days ago`, color: colors.gold }
  if (days === 0) return { label: 'Today', color: colors.g700 }
  return { label: `${days} day${days === 1 ? '' : 's'} ago`, color: colors.g700 }
}

export function ActivityList({ people }: { people: Profile[] }) {
  const [filter, setFilter] = useState<ActivityFilter>('all')

  const rows = useMemo(() => {
    return people
      .map((p) => ({ profile: p, days: daysSince(p.last_active_at), left: p.self_reported_left_at !== null }))
      .filter((r) => {
        if (filter === 'all') return true
        if (filter === 'left') return r.left
        if (filter === 'never') return r.days === null
        if (filter === '60') return r.days === null || r.days >= 60
        return r.days === null || r.days >= 90
      })
      .sort((a, b) => {
        // Self-reported "I've left" is the strongest signal there is —
        // surface it above mere inactivity regardless of days-since.
        if (a.left !== b.left) return a.left ? -1 : 1
        if (a.days === null && b.days === null) return 0
        if (a.days === null) return -1
        if (b.days === null) return 1
        return b.days - a.days
      })
  }, [people, filter])

  return (
    <Card>
      <Text style={styles.cardTitle}>Member Activity</Text>
      <Text style={{ fontSize: 11.5, color: colors.muted, marginTop: -6, marginBottom: 10, fontStyle: 'italic' }}>
        Time since each member last opened the app or signed in — a signal to notice who's drifting away, not an automated record. Dependents don't log in, so
        they aren't listed here.
      </Text>
      <View style={styles.filterRow}>
        <FilterChip label="All" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterChip label="60+ days" active={filter === '60'} onPress={() => setFilter('60')} />
        <FilterChip label="90+ days" active={filter === '90'} onPress={() => setFilter('90')} />
        <FilterChip label="Never logged in" active={filter === 'never'} onPress={() => setFilter('never')} />
        <FilterChip label="Says they've left" active={filter === 'left'} onPress={() => setFilter('left')} />
      </View>
      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No members match this filter.</Text>
      ) : (
        rows.map(({ profile, days, left }) => {
          const s = staleness(days)
          return (
            <View key={profile.id} style={styles.pendingRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>{profile.full_name}</Text>
                <Chip label={s.label} color={s.color} />
              </View>
              {left ? (
                <Text style={{ fontSize: 11.5, color: colors.danger, fontWeight: '700', marginTop: 4 }}>
                  Says they've left{profile.self_reported_left_at ? ` — ${new Date(profile.self_reported_left_at).toLocaleDateString('en-ZA')}` : ''}
                </Text>
              ) : profile.membership_confirmed_at ? (
                <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>
                  Confirmed still a member {new Date(profile.membership_confirmed_at).toLocaleDateString('en-ZA')}
                </Text>
              ) : null}
            </View>
          )
        })
      )}
    </Card>
  )
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      {label}
    </Text>
  )
}
