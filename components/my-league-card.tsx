import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Image, Text, View } from 'react-native'
import { Card } from './ui'
import { styles as statStyles } from './stat-cards.styles'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { useCongregationData } from '../lib/congregation-context'
import { formatShortDate, toLocalISODate } from '../lib/dates'
import { colors } from '../theme'
import type { Announcement, ChurchEventRow } from '../lib/types'

export function MyLeagueCard() {
  const { profile } = useAuth()
  const { leagues } = useCongregationData()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [events, setEvents] = useState<ChurchEventRow[]>([])

  const leagueId = profile?.league_id ?? null
  const league = leagues.find((l) => l.id === leagueId)

  useFocusEffect(
    useCallback(() => {
      if (!leagueId) return
      let cancelled = false
      Promise.all([
        supabase.from('announcements').select('*').eq('league_id', leagueId).order('created_at', { ascending: false }),
        supabase.from('events').select('*').eq('league_id', leagueId).gte('event_date', toLocalISODate(new Date())).order('event_date'),
      ]).then(([{ data: ann }, { data: ev }]) => {
        if (cancelled) return
        setAnnouncements((ann as Announcement[]) ?? [])
        setEvents((ev as ChurchEventRow[]) ?? [])
      })
      return () => {
        cancelled = true
      }
    }, [leagueId])
  )

  if (!leagueId) {
    return (
      <Card>
        <Text style={statStyles.cardTitle}>My League</Text>
        <Text style={statStyles.cardSub}>You're not in a league yet — join one from your Portal, on the Dashboard tab.</Text>
      </Card>
    )
  }

  return (
    <Card>
      <Text style={statStyles.cardTitle}>{league?.label ?? 'My League'}</Text>
      <Text style={statStyles.cardSub}>Announcements and upcoming events just for your league</Text>

      {events.length === 0 && announcements.length === 0 ? (
        <Text style={{ fontSize: 12.5, color: colors.muted, fontStyle: 'italic' }}>Nothing posted yet.</Text>
      ) : null}

      {events.map((e) => (
        <View key={e.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.cream }}>
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>{formatShortDate(e.event_date)}</Text>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>{e.title}</Text>
          {e.description ? <Text style={{ fontSize: 12.5, color: colors.text }}>{e.description}</Text> : null}
        </View>
      ))}

      {announcements.map((a) => (
        <View key={a.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.cream }}>
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>{a.date_text}</Text>
          <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>{a.title}</Text>
          {a.poster ? <Image source={{ uri: a.poster }} style={{ width: '100%', height: 150, borderRadius: 10, marginTop: 6, backgroundColor: colors.cream }} resizeMode="cover" /> : null}
          <Text style={{ fontSize: 12.5, color: colors.text }}>{a.body}</Text>
        </View>
      ))}
    </Card>
  )
}
