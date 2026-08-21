import { useState } from 'react'
import { Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import { Button, Card, DateField, Field, SelectField } from './ui'
import { styles } from './portal-details-card.styles'
import { supabase } from '../lib/supabase'
import { genders } from '../theme'
import type { Profile } from '../lib/types'

export function PortalDetailsCard({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const [phone, setPhone] = useState('')
  const [phoneDirty, setPhoneDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  async function savePhone() {
    setBusy(true)
    const { error } = await supabase.rpc('update_my_phone', { new_phone: phone.trim() || null })
    setBusy(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    setPhoneDirty(false)
    onChanged()
  }

  async function saveBirthday(iso: string) {
    setBusy(true)
    const { error } = await supabase.rpc('update_my_birthday', { new_dob: iso })
    setBusy(false)
    if (error) Alert.alert('Could not save', error.message)
    else onChanged()
  }

  async function saveGender(value: string) {
    setBusy(true)
    const { error } = await supabase.rpc('update_my_gender', { new_gender: value })
    setBusy(false)
    if (error) Alert.alert('Could not save', error.message)
    else onChanged()
  }

  const currentPhone = phoneDirty ? phone : profile.phone ?? ''

  return (
    <Card>
      <Text style={styles.cardTitle}>My Details</Text>
      <View style={{ gap: 12, marginTop: 4 }}>
        <View style={{ gap: 6 }}>
          <Field
            label="Phone"
            value={currentPhone}
            onChangeText={(v) => {
              setPhone(v)
              setPhoneDirty(true)
            }}
            keyboardType="phone-pad"
            placeholder="0760293340"
          />
          {phoneDirty ? <Button title="Save Phone" loading={busy} onPress={savePhone} /> : null}
        </View>
        <DateField label="Birthday" value={profile.date_of_birth} maximumDate={new Date()} onChange={saveBirthday} />
        <SelectField
          label="Gender"
          value={profile.gender ?? ''}
          onChange={saveGender}
          options={genders.map((g) => ({ value: g, label: g }))}
          placeholder="Not set"
        />
      </View>
    </Card>
  )
}
