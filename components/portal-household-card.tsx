import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Button, Card, DateField, Field, SelectField } from './ui'
import { SignaturePad } from './signature-pad'
import { CertificatePicker } from './certificate-picker'
import { Wizard, type WizardStepDef } from './wizard'
import { DependentCard } from './dependent-card'
import { styles } from './portal-household-card.styles'
import { supabase } from '../lib/supabase'
import { genders, leagueKeys, leagues, wards } from '../theme'
import type { Dependent } from '../lib/types'

export function PortalHouseholdCard({ dependents, onChanged }: { dependents: Dependent[]; onChanged: () => void }) {
  const [addingChild, setAddingChild] = useState(false)
  const [childName, setChildName] = useState('')
  const [childDob, setChildDob] = useState<string | null>(null)
  const [childGender, setChildGender] = useState('')
  const [childWard, setChildWard] = useState('')
  const [childLeague, setChildLeague] = useState('')
  const [childBaptised, setChildBaptised] = useState('')
  const [childConfirmed, setChildConfirmed] = useState('')
  const [childBaptismType, setChildBaptismType] = useState('')
  const [childSponsorName, setChildSponsorName] = useState('')
  const [childMentorName, setChildMentorName] = useState('')
  const [childLeagueReason, setChildLeagueReason] = useState('')
  const [childBaptismCert, setChildBaptismCert] = useState<string | null>(null)
  const [childConfirmationCert, setChildConfirmationCert] = useState<string | null>(null)
  const [childSignature, setChildSignature] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function addChild() {
    setBusy(true)
    const { error } = await supabase.rpc('add_dependent', {
      p_full_name: childName.trim(),
      p_date_of_birth: childDob,
      p_ward: childWard,
      p_gender: childGender || null,
      p_initial_league: childLeague || null,
      p_already_baptised: childBaptised === 'yes',
      p_already_confirmed: childConfirmed === 'yes',
      p_baptism_type: childBaptismType || null,
      p_sponsor_name: childSponsorName.trim() || null,
      p_mentor_name: childMentorName.trim() || null,
      p_league_reason: childLeagueReason.trim() || null,
      p_signature: childSignature,
      p_baptism_certificate: childBaptismCert,
      p_confirmation_certificate: childConfirmationCert,
    })
    setBusy(false)
    if (error) {
      Alert.alert('Could not add', error.message)
      return
    }
    setChildName('')
    setChildDob(null)
    setChildGender('')
    setChildWard('')
    setChildLeague('')
    setChildBaptised('')
    setChildConfirmed('')
    setChildBaptismType('')
    setChildSponsorName('')
    setChildMentorName('')
    setChildLeagueReason('')
    setChildBaptismCert(null)
    setChildConfirmationCert(null)
    setChildSignature(null)
    setAddingChild(false)
    onChanged()
  }

  const addChildSteps: WizardStepDef[] = [
    {
      key: 'name',
      title: "Child's Name",
      validate: () => (!childName.trim() ? "Please enter the child's name." : null),
      render: () => <Field label="Full Name" value={childName} onChangeText={setChildName} placeholder="e.g. Tumelo Mogowe" />,
    },
    {
      key: 'birthday',
      title: 'Birthday',
      subtitle: 'Optional.',
      render: () => <DateField label="Birthday (optional)" value={childDob} maximumDate={new Date()} onChange={setChildDob} />,
    },
    {
      key: 'ward',
      title: 'Ward & Gender',
      validate: () => (!childWard ? 'Please select a ward.' : null),
      render: () => (
        <>
          <SelectField label="Ward" value={childWard} onChange={setChildWard} options={wards.map((w) => ({ value: w, label: `${w} Ward` }))} />
          <SelectField label="Gender (optional)" value={childGender} onChange={setChildGender} options={genders.map((g) => ({ value: g, label: g }))} placeholder="Select…" />
        </>
      ),
    },
    {
      key: 'involvement',
      title: 'Sacraments & League',
      subtitle: 'Already baptised, confirmed, or part of a league? Tell us now. It\'s recorded on their record right away, no approval needed.',
      validate: () => {
        if (childConfirmed === 'yes' && childBaptised !== 'yes') {
          return 'Confirmation always follows baptism. Please also answer "Yes" to already baptised, or leave both blank if you\'re not sure.'
        }
        const claimingSomething = childBaptised === 'yes' || childConfirmed === 'yes' || !!childLeague
        if (claimingSomething && !childSignature) {
          return 'Please sign below to confirm what you told us here is accurate.'
        }
        return null
      },
      render: () => (
        <>
          <SelectField
            label="Already baptised?"
            value={childBaptised}
            onChange={setChildBaptised}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No / Not yet' },
            ]}
            placeholder="Select…"
          />
          {childBaptised === 'yes' ? (
            <>
              <SelectField
                label="Baptism type"
                value={childBaptismType}
                onChange={setChildBaptismType}
                options={[
                  { value: 'Infant', label: 'Infant' },
                  { value: 'Adult', label: 'Adult' },
                ]}
                placeholder="Select…"
              />
              <Field label="Sponsor / Godparent name" value={childSponsorName} onChangeText={setChildSponsorName} placeholder="e.g. Thabo Mokoena" />
            </>
          ) : null}
          <SelectField
            label="Already confirmed?"
            value={childConfirmed}
            onChange={setChildConfirmed}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No / Not yet' },
            ]}
            placeholder="Select…"
          />
          {childConfirmed === 'yes' ? (
            <>
              <Field label="Confirmation mentor (optional)" value={childMentorName} onChangeText={setChildMentorName} placeholder="If they have one" />
              <CertificatePicker label="Baptism Certificate (optional, if applicable)" value={childBaptismCert} onChange={setChildBaptismCert} />
            </>
          ) : null}
          <SelectField
            label="League / Organisation (optional)"
            value={childLeague}
            onChange={setChildLeague}
            options={leagueKeys.map((k) => ({ value: k, label: leagues[k].label }))}
            placeholder="Select if they already belong to one…"
          />
          {childLeague ? (
            <>
              <Field label="Why would they like to join? (optional)" value={childLeagueReason} onChangeText={setChildLeagueReason} placeholder="A short reason" />
              {childConfirmed !== 'yes' ? <CertificatePicker label="Baptism Certificate (optional)" value={childBaptismCert} onChange={setChildBaptismCert} /> : null}
              <CertificatePicker label="Confirmation Certificate (optional)" value={childConfirmationCert} onChange={setChildConfirmationCert} />
            </>
          ) : null}
          {childBaptised === 'yes' || childConfirmed === 'yes' || childLeague ? (
            <>
              <Text style={styles.signatureNote}>As their guardian, sign to confirm the above is accurate.</Text>
              <SignaturePad value={childSignature} onChange={setChildSignature} />
            </>
          ) : null}
        </>
      ),
    },
  ]

  return (
    <Card>
      <Text style={styles.cardTitle}>My Household</Text>
      <Text style={styles.cardSub}>Register children who don't have their own phone. You manage their league, baptism and confirmation here.</Text>

      {dependents.map((d) => (
        <DependentCard key={d.id} dependent={d} onChanged={onChanged} />
      ))}

      {addingChild ? (
        <View style={styles.addChildForm}>
          <Wizard steps={addChildSteps} onComplete={addChild} completeLabel="Add Child" submitting={busy} />
          <View style={{ marginTop: 10 }}>
            <Button title="Cancel" variant="secondary" onPress={() => setAddingChild(false)} />
          </View>
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Button title="＋ Add Child" variant="secondary" onPress={() => setAddingChild(true)} />
        </View>
      )}
    </Card>
  )
}
