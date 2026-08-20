import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Button, Card, Field, SelectField } from './ui'
import { LeagueBadge } from './league-badge'
import { SignaturePad } from './signature-pad'
import { CertificatePicker } from './certificate-picker'
import { styles } from './portal-involvement-card.styles'
import { supabase } from '../lib/supabase'
import { leagueKeys, leagues } from '../theme'
import type { LeagueKey, Profile } from '../lib/types'

export function PortalInvolvementCard({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)

  const [selectedLeague, setSelectedLeague] = useState<LeagueKey | null>(null)
  const [leagueReason, setLeagueReason] = useState('')
  const [leagueSignature, setLeagueSignature] = useState<string | null>(null)
  const [leagueBaptismCert, setLeagueBaptismCert] = useState<string | null>(null)
  const [leagueConfirmationCert, setLeagueConfirmationCert] = useState<string | null>(null)

  const [showBaptismForm, setShowBaptismForm] = useState(false)
  const [baptismType, setBaptismType] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [baptismNote, setBaptismNote] = useState('')
  const [baptismSignature, setBaptismSignature] = useState<string | null>(null)

  const [showConfirmationForm, setShowConfirmationForm] = useState(false)
  const [mentorName, setMentorName] = useState('')
  const [confirmationNote, setConfirmationNote] = useState('')
  const [confirmationSignature, setConfirmationSignature] = useState<string | null>(null)
  const [confirmationBaptismCert, setConfirmationBaptismCert] = useState<string | null>(null)

  async function runAction(fn: () => PromiseLike<{ error: any }>) {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) {
      Alert.alert('Something went wrong', error.message)
      return false
    }
    onChanged()
    return true
  }

  async function submitLeagueRequest() {
    const target = selectedLeague ?? profile.league
    if (target === profile.league) {
      Alert.alert('Already there', 'You are already in this league.')
      return
    }
    if (!leagueSignature) {
      Alert.alert('Please sign', 'Sign below to confirm this request.')
      return
    }
    const ok = await runAction(() =>
      supabase.rpc('request_league', {
        new_league: target,
        p_reason: leagueReason.trim() || null,
        p_signature: leagueSignature,
        p_baptism_certificate: leagueBaptismCert,
        p_confirmation_certificate: leagueConfirmationCert,
      })
    )
    if (ok) {
      setSelectedLeague(null)
      setLeagueReason('')
      setLeagueSignature(null)
      setLeagueBaptismCert(null)
      setLeagueConfirmationCert(null)
    }
  }

  async function submitBaptismRequest() {
    if (!baptismSignature) {
      Alert.alert('Please sign', 'Sign below to confirm this request.')
      return
    }
    const ok = await runAction(() =>
      supabase.rpc('request_baptism', { p_type: baptismType || null, p_sponsor_name: sponsorName.trim() || null, p_note: baptismNote.trim() || null, p_signature: baptismSignature })
    )
    if (ok) {
      setShowBaptismForm(false)
      setBaptismType('')
      setSponsorName('')
      setBaptismNote('')
      setBaptismSignature(null)
    }
  }

  async function submitConfirmationRequest() {
    if (!confirmationSignature) {
      Alert.alert('Please sign', 'Sign below to confirm this request.')
      return
    }
    const ok = await runAction(() =>
      supabase.rpc('request_confirmation', {
        p_mentor_name: mentorName.trim() || null,
        p_note: confirmationNote.trim() || null,
        p_signature: confirmationSignature,
        p_baptism_certificate: confirmationBaptismCert,
      })
    )
    if (ok) {
      setShowConfirmationForm(false)
      setMentorName('')
      setConfirmationNote('')
      setConfirmationSignature(null)
      setConfirmationBaptismCert(null)
    }
  }

  return (
    <Card>
      <Text style={styles.cardTitle}>Update Your Involvement</Text>
      <Text style={styles.cardSub}>Requests are reviewed and confirmed by the parish office.</Text>

      <View style={styles.actionRow}>
        <Text style={styles.actionLabel}>League</Text>
        {profile.pending_league ? (
          <View style={styles.actionCol}>
            <Text style={styles.hintText}>
              Your request to join <Text style={{ fontWeight: '700' }}>{leagues[profile.pending_league].label}</Text> is awaiting approval.
            </Text>
            <Button title="Cancel Request" variant="danger" loading={busy} onPress={() => runAction(() => supabase.rpc('cancel_league_request'))} />
          </View>
        ) : (
          <View style={styles.actionCol}>
            {leagueKeys.map((k) => (
              <Text
                key={k}
                onPress={() => setSelectedLeague(k as LeagueKey)}
                style={[styles.leagueOption, (selectedLeague ?? profile.league) === k && styles.leagueOptionActive]}
              >
                {leagues[k].label}
              </Text>
            ))}
            {leagues[selectedLeague ?? profile.league]?.info ? (
              <View style={styles.infoRow}>
                <LeagueBadge leagueKey={(selectedLeague ?? profile.league) as LeagueKey} size={36} />
                <Text style={[styles.hintText, { flex: 1 }]}>{leagues[selectedLeague ?? profile.league].info}</Text>
              </View>
            ) : null}
            {selectedLeague && selectedLeague !== profile.league ? (
              <>
                <Field label="Why would you like to join? (optional)" value={leagueReason} onChangeText={setLeagueReason} placeholder="A short reason" />
                <CertificatePicker label="Baptism Certificate (optional)" value={leagueBaptismCert} onChange={setLeagueBaptismCert} />
                <CertificatePicker label="Confirmation Certificate (optional)" value={leagueConfirmationCert} onChange={setLeagueConfirmationCert} />
                <SignaturePad value={leagueSignature} onChange={setLeagueSignature} />
              </>
            ) : null}
            <Button title="Request Change" loading={busy} onPress={submitLeagueRequest} />
          </View>
        )}
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.actionLabel}>Baptism</Text>
        {profile.baptised ? (
          <Text style={styles.hintText}>You are baptised. Praise God! ✝</Text>
        ) : profile.pending_baptism ? (
          <View style={styles.actionCol}>
            <Text style={styles.hintText}>Your baptism request is awaiting approval.</Text>
            <Button title="Cancel Request" variant="danger" loading={busy} onPress={() => runAction(() => supabase.rpc('cancel_baptism_request'))} />
          </View>
        ) : showBaptismForm ? (
          <View style={styles.actionCol}>
            <SelectField
              label="Baptism type"
              value={baptismType}
              onChange={setBaptismType}
              options={[
                { value: 'Infant', label: 'Infant' },
                { value: 'Adult', label: 'Adult' },
              ]}
              placeholder="Select…"
            />
            <Field label="Sponsor / Godparent name" value={sponsorName} onChangeText={setSponsorName} placeholder="e.g. Thabo Mokoena" />
            <Field label="Note (optional)" value={baptismNote} onChangeText={setBaptismNote} placeholder="Anything else the office should know" />
            <SignaturePad value={baptismSignature} onChange={setBaptismSignature} />
            <Button title="Submit Request" loading={busy} onPress={submitBaptismRequest} />
            <Button title="Cancel" variant="secondary" onPress={() => setShowBaptismForm(false)} />
          </View>
        ) : (
          <Button title="Request Baptism" onPress={() => setShowBaptismForm(true)} />
        )}
      </View>

      <View style={[styles.actionRow, { borderBottomWidth: 0 }]}>
        <Text style={styles.actionLabel}>Confirmation</Text>
        {profile.confirmed ? (
          <Text style={styles.hintText}>You are confirmed. Praise God! ✝</Text>
        ) : profile.pending_confirmation ? (
          <View style={styles.actionCol}>
            <Text style={styles.hintText}>Your confirmation request is awaiting approval.</Text>
            <Button title="Cancel Request" variant="danger" loading={busy} onPress={() => runAction(() => supabase.rpc('cancel_confirmation_request'))} />
          </View>
        ) : !profile.baptised ? (
          <Text style={styles.hintText}>Baptism is required first.</Text>
        ) : showConfirmationForm ? (
          <View style={styles.actionCol}>
            <Field label="Confirmation mentor (optional)" value={mentorName} onChangeText={setMentorName} placeholder="If you have one" />
            <Field label="Note (optional)" value={confirmationNote} onChangeText={setConfirmationNote} placeholder="Anything else the office should know" />
            <CertificatePicker label="Baptism Certificate (optional, if applicable)" value={confirmationBaptismCert} onChange={setConfirmationBaptismCert} />
            <SignaturePad value={confirmationSignature} onChange={setConfirmationSignature} />
            <Button title="Submit Request" loading={busy} onPress={submitConfirmationRequest} />
            <Button title="Cancel" variant="secondary" onPress={() => setShowConfirmationForm(false)} />
          </View>
        ) : (
          <Button title="Request Confirmation" onPress={() => setShowConfirmationForm(true)} />
        )}
      </View>
    </Card>
  )
}
