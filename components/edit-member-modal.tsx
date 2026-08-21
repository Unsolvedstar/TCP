import { useState } from 'react'
import { Modal, ScrollView, Switch, Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import { Button, DateField, Field, SelectField, formatDate } from './ui'
import { Wizard, type WizardStepDef } from './wizard'
import { styles } from './edit-modal.styles'
import { supabase } from '../lib/supabase'
import { colors, genders } from '../theme'
import { useCongregationData } from '../lib/congregation-context'
import type { Profile } from '../lib/types'

export function EditMemberModal({
  member,
  onClose,
  onSaved,
  onRemoved,
  onPromoted,
}: {
  member: Profile
  onClose: () => void
  onSaved: () => void
  onRemoved: () => void
  onPromoted: () => void
}) {
  const { wards, leagues } = useCongregationData()
  const [fullName, setFullName] = useState(member.full_name)
  const [phone, setPhone] = useState(member.phone ?? '')
  const [dob, setDob] = useState<string | null>(member.date_of_birth)
  const [gender, setGender] = useState(member.gender ?? '')
  const [wardId, setWardId] = useState(member.ward_id)
  const [leagueId, setLeagueId] = useState(member.league_id ?? '')
  const [baptised, setBaptised] = useState(member.baptised)
  const [confirmed, setConfirmed] = useState(member.confirmed)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase.rpc('admin_update_member', {
      target_id: member.id,
      p_full_name: fullName.trim(),
      p_phone: phone.trim() || null,
      p_ward_id: wardId,
      p_league_id: leagueId || null,
      p_baptised: baptised,
      p_confirmed: confirmed,
      p_date_of_birth: dob,
      p_gender: gender || null,
    })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    onSaved()
  }

  const steps: WizardStepDef[] = [
    {
      key: 'basics',
      title: 'Basic Info',
      validate: () => (!fullName.trim() ? 'Please enter a name.' : null),
      render: () => (
        <>
          <Field label="Full Name" value={fullName} onChangeText={setFullName} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        </>
      ),
    },
    {
      key: 'birthday-ward',
      title: 'Birthday, Gender & Ward',
      render: () => (
        <>
          <DateField label="Birthday" value={dob} maximumDate={new Date()} onChange={setDob} />
          <SelectField label="Gender" value={gender} onChange={setGender} options={genders.map((g) => ({ value: g, label: g }))} placeholder="Not set" />
          <SelectField label="Ward" value={wardId} onChange={setWardId} options={wards.map((w) => ({ value: w.id, label: `${w.name} Ward` }))} />
        </>
      ),
    },
    {
      key: 'league',
      title: 'League / Organisation',
      render: () => (
        <SelectField
          label="League / Organisation"
          value={leagueId}
          onChange={setLeagueId}
          options={[
            { value: '', label: 'No League / Organisation' },
            ...leagues.map((l) => ({ value: l.id, label: l.label })),
          ]}
        />
      ),
    },
    {
      key: 'sacraments',
      title: 'Sacraments',
      render: () => (
        <>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Baptised</Text>
            <Switch value={baptised} onValueChange={setBaptised} trackColor={{ true: colors.g700 }} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Confirmed</Text>
            <Switch value={confirmed} onValueChange={setConfirmed} trackColor={{ true: colors.g700 }} />
          </View>
        </>
      ),
    },
  ]

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        <Text style={styles.modalHeading}>Edit Member</Text>
        {member.reviewed_at ? <Text style={styles.guardianNote}>Last reviewed {formatDate(member.reviewed_at.slice(0, 10))}</Text> : null}
        <Wizard steps={steps} onComplete={save} completeLabel="Save Changes" submitting={saving} />
        <View style={{ gap: 10, marginTop: 20 }}>
          <Button title="Cancel" variant="secondary" onPress={onClose} />
          <Button title="Promote to Admin" variant="secondary" onPress={onPromoted} />
          <Button title="Remove From Registry" variant="danger" onPress={onRemoved} />
        </View>
      </ScrollView>
    </Modal>
  )
}
