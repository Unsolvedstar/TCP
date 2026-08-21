import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import { Button, Chip, DateField, Field, SelectField, formatDate } from './ui'
import { SignaturePad } from './signature-pad'
import { CertificatePicker } from './certificate-picker'
import { styles } from './dependent-card.styles'
import { supabase } from '../lib/supabase'
import { colors, genderColors, genders } from '../theme'
import { useCongregationData } from '../lib/congregation-context'
import type { Dependent } from '../lib/types'

const NONE_LEAGUE = { label: 'No League / Organisation', color: '#9e9e9e' }

export function DependentCard({ dependent, onChanged }: { dependent: Dependent; onChanged: () => void }) {
  const { wards, leagues } = useCongregationData()
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editingDob, setEditingDob] = useState(false)
  const [editingGender, setEditingGender] = useState(false)

  // '' is the sentinel for "no league" — mirrors the null-means-None pattern
  // in the schema, since a plain string state can't hold null cleanly here.
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null)
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

  async function run(fn: () => PromiseLike<{ error: any }>) {
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
    // '' means "explicitly selected No League"; normalize it to null (the
    // schema's actual "no league" value) before comparing/sending.
    const target = selectedLeague === null ? dependent.league_id : selectedLeague || null
    if (target === dependent.league_id) {
      Alert.alert('Already there', `${dependent.full_name} is already in this league.`)
      return
    }
    if (!leagueSignature) {
      Alert.alert('Please sign', 'Sign below to confirm this request.')
      return
    }
    const ok = await run(() =>
      supabase.rpc('request_dependent_league', {
        target_id: dependent.id,
        new_league_id: target,
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
    const ok = await run(() =>
      supabase.rpc('request_dependent_baptism', {
        target_id: dependent.id,
        p_type: baptismType || null,
        p_sponsor_name: sponsorName.trim() || null,
        p_note: baptismNote.trim() || null,
        p_signature: baptismSignature,
      })
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
    const ok = await run(() =>
      supabase.rpc('request_dependent_confirmation', {
        target_id: dependent.id,
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

  const league = leagues.find((l) => l.id === dependent.league_id) ?? NONE_LEAGUE
  const ward = wards.find((w) => w.id === dependent.ward_id)

  return (
    <View style={styles.card}>
      <Pressable style={styles.headerRow} onPress={() => setExpanded((v) => !v)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{dependent.full_name}</Text>
          <Text style={styles.sub}>{dependent.date_of_birth ? formatDate(dependent.date_of_birth) : 'No birthday on file'}</Text>
        </View>
        <Text style={styles.expandLink}>{expanded ? 'Close' : 'Manage'}</Text>
      </Pressable>

      <View style={styles.chipRow}>
        {ward ? <Chip label={ward.name} color={ward.color} /> : null}
        {dependent.gender ? <Chip label={dependent.gender} color={genderColors[dependent.gender]} /> : null}
        <Chip label={league.label} color={league.color} />
        <Chip label={dependent.baptised ? 'Baptised' : dependent.pending_baptism ? 'Baptism Pending' : 'Not Baptised'} color={dependent.baptised ? colors.g700 : dependent.pending_baptism ? colors.gold : colors.muted} />
        <Chip label={dependent.confirmed ? 'Confirmed' : dependent.pending_confirmation ? 'Confirmation Pending' : 'Not Confirmed'} color={dependent.confirmed ? colors.g700 : dependent.pending_confirmation ? colors.gold : colors.muted} />
      </View>

      {expanded && (
        <View style={styles.expandedBody}>
          <View style={styles.actionRow}>
            <Text style={styles.actionLabel}>League</Text>
            {dependent.pending_league_id ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.hint}>
                  Request to join{' '}
                  <Text style={{ fontWeight: '700' }}>{leagues.find((l) => l.id === dependent.pending_league_id)?.label ?? NONE_LEAGUE.label}</Text> is
                  awaiting approval.
                </Text>
                <Button title="Cancel Request" variant="danger" loading={busy} onPress={() => run(() => supabase.rpc('cancel_dependent_league_request', { target_id: dependent.id }))} />
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {[{ id: '', label: NONE_LEAGUE.label }, ...leagues].map((l) => (
                  <Text
                    key={l.id}
                    onPress={() => setSelectedLeague(l.id)}
                    style={[styles.leagueOption, (selectedLeague ?? dependent.league_id ?? '') === l.id && styles.leagueOptionActive]}
                  >
                    {l.label}
                  </Text>
                ))}
                {selectedLeague !== null && (selectedLeague || null) !== dependent.league_id ? (
                  <>
                    <Field label="Why would they like to join? (optional)" value={leagueReason} onChangeText={setLeagueReason} placeholder="A short reason" />
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
            {dependent.baptised ? (
              <Text style={styles.hint}>Baptised. Praise God! ✝</Text>
            ) : dependent.pending_baptism ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.hint}>Baptism request is awaiting approval.</Text>
                <Button title="Cancel Request" variant="danger" loading={busy} onPress={() => run(() => supabase.rpc('cancel_dependent_baptism_request', { target_id: dependent.id }))} />
              </View>
            ) : showBaptismForm ? (
              <View style={{ gap: 8 }}>
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
            {dependent.confirmed ? (
              <Text style={styles.hint}>Confirmed. Praise God! ✝</Text>
            ) : dependent.pending_confirmation ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.hint}>Confirmation request is awaiting approval.</Text>
                <Button title="Cancel Request" variant="danger" loading={busy} onPress={() => run(() => supabase.rpc('cancel_dependent_confirmation_request', { target_id: dependent.id }))} />
              </View>
            ) : !dependent.baptised ? (
              <Text style={styles.hint}>Baptism is required first.</Text>
            ) : showConfirmationForm ? (
              <View style={{ gap: 8 }}>
                <Field label="Confirmation mentor (optional)" value={mentorName} onChangeText={setMentorName} placeholder="If they have one" />
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

          {editingDob ? (
            <View style={styles.actionRow}>
              <Text style={styles.actionLabel}>Birthday</Text>
              <DateField
                label=""
                value={dependent.date_of_birth}
                maximumDate={new Date()}
                onChange={async (iso) => {
                  const ok = await run(() =>
                    supabase.rpc('update_my_dependent', {
                      target_id: dependent.id,
                      p_full_name: dependent.full_name,
                      p_date_of_birth: iso,
                      p_ward_id: dependent.ward_id,
                      p_gender: dependent.gender,
                    })
                  )
                  if (ok) setEditingDob(false)
                }}
              />
            </View>
          ) : (
            <Text style={styles.editLink} onPress={() => setEditingDob(true)}>
              Edit birthday
            </Text>
          )}

          {editingGender ? (
            <View style={styles.actionRow}>
              <Text style={styles.actionLabel}>Gender</Text>
              <SelectField
                label=""
                value={dependent.gender ?? ''}
                options={genders.map((g) => ({ value: g, label: g }))}
                onChange={async (value) => {
                  const ok = await run(() =>
                    supabase.rpc('update_my_dependent', {
                      target_id: dependent.id,
                      p_full_name: dependent.full_name,
                      p_date_of_birth: dependent.date_of_birth,
                      p_ward_id: dependent.ward_id,
                      p_gender: value,
                    })
                  )
                  if (ok) setEditingGender(false)
                }}
              />
            </View>
          ) : (
            <Text style={styles.editLink} onPress={() => setEditingGender(true)}>
              Edit gender
            </Text>
          )}

          <Button
            title="Remove From Household"
            variant="danger"
            loading={busy}
            onPress={() =>
              Alert.alert('Remove', `Remove ${dependent.full_name} from your household?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => run(() => supabase.rpc('remove_my_dependent', { target_id: dependent.id })) },
              ])
            }
          />
        </View>
      )}
    </View>
  )
}
