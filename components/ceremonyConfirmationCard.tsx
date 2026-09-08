import { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import { Button, Card, formatDate } from './ui'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'
import type { CeremonyKind } from '../lib/types'

type ProposalRow = {
  id: string
  kind: CeremonyKind
  ceremony_date: string
  subject_dependent_id: string | null
  leagues: { label: string } | null
  dependents: { full_name: string } | null
}

function ceremonyLabel(p: ProposalRow): string {
  if (p.kind === 'baptism') return 'Baptism'
  if (p.kind === 'confirmation') return 'Confirmation'
  return `${p.leagues?.label ?? 'League'} Installation`
}

export function CeremonyConfirmationCard() {
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('ceremony_proposals')
      .select('id, kind, ceremony_date, subject_dependent_id, leagues(label), dependents:subject_dependent_id(full_name)')
      .eq('status', 'proposed')
      .order('ceremony_date')
    setProposals((data as unknown as ProposalRow[]) ?? [])
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  async function respond(id: string, confirm: boolean) {
    setBusyId(id)
    const { error } = await supabase.rpc(confirm ? 'confirm_ceremony_date' : 'decline_ceremony_date', { proposal_id: id })
    setBusyId(null)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    load()
  }

  if (proposals.length === 0) return null

  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.g800 }}>Ceremony Date Proposed</Text>
      <Text style={{ fontSize: 12.5, color: colors.muted, marginBottom: 10, marginTop: 2 }}>
        The parish office has scheduled a date — please confirm it works.
      </Text>
      {proposals.map((p) => {
        const who = p.subject_dependent_id ? p.dependents?.full_name ?? 'Your child' : 'You'
        const busy = busyId === p.id
        return (
          <View key={p.id} style={{ borderTopWidth: 1, borderTopColor: colors.cream, paddingTop: 10, marginTop: 10, gap: 8 }}>
            <Text style={{ fontSize: 13.5, color: colors.text }}>
              {who === 'You' ? 'Your' : `${who}'s`} <Text style={{ fontWeight: '700' }}>{ceremonyLabel(p)}</Text> has been scheduled for{' '}
              <Text style={{ fontWeight: '700' }}>{formatDate(p.ceremony_date)}</Text>. Does that work?
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Yes, that works" onPress={() => respond(p.id, true)} loading={busy} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Needs a different date" variant="secondary" onPress={() => respond(p.id, false)} loading={busy} />
              </View>
            </View>
          </View>
        )
      })}
    </Card>
  )
}
