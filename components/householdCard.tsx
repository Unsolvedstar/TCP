import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Alert } from '../lib/alert'
import { styles } from './householdCard.styles'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'
import type { ChildRow, Household, Profile } from '../lib/types'

export function HouseholdCard({
  household,
  members,
  dependents,
  onChanged,
}: {
  household: Household
  members: Profile[]
  dependents: ChildRow[]
  onChanged: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(household.name ?? '')
  const [busy, setBusy] = useState(false)
  const unclaimed = household.name === null

  async function saveRename() {
    const name = nameInput.trim()
    if (!name) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_rename_household', { target_id: household.id, p_name: name })
    setBusy(false)
    if (error) {
      Alert.alert('Could not rename', error.message)
      return
    }
    setRenaming(false)
    onChanged()
  }

  function confirmRegenerateCode() {
    Alert.alert(
      'Regenerate family code',
      `Give "${household.name ?? 'this unclaimed code'}" a new join code? The old code (${household.code}) will stop working — anyone already in this family is unaffected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: async () => {
          const { error } = await supabase.rpc('admin_regenerate_household_code', { target_id: household.id })
          if (error) Alert.alert('Could not regenerate', error.message)
          else onChanged()
        } },
      ]
    )
  }

  function confirmDelete() {
    const message = unclaimed
      ? 'Delete this unclaimed code? It will stop working — no one has used it yet.'
      : `Delete "${household.name}"? Members stay in the registry, just no longer grouped together.`
    Alert.alert('Delete family', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.rpc('admin_delete_household', { target_id: household.id })
        if (error) Alert.alert('Could not delete', error.message)
        else onChanged()
      } },
    ])
  }

  async function removeMember(id: string) {
    const { error } = await supabase.rpc('admin_set_profile_household', { target_id: id, p_household_id: null })
    if (error) Alert.alert('Could not update', error.message)
    else onChanged()
  }

  async function removeDependent(id: string) {
    const { error } = await supabase.rpc('admin_set_dependent_household', { target_id: id, p_household_id: null })
    if (error) Alert.alert('Could not update', error.message)
    else onChanged()
  }

  return (
    <View style={styles.card}>
      {renaming ? (
        <View style={styles.editingRow}>
          <TextInput style={styles.nameInput} value={nameInput} onChangeText={setNameInput} autoFocus placeholderTextColor="#a99" />
          <Text style={styles.headerLink} onPress={busy ? undefined : saveRename}>Save</Text>
          <Text
            style={styles.headerLink}
            onPress={() => {
              setNameInput(household.name ?? '')
              setRenaming(false)
            }}
          >
            Cancel
          </Text>
        </View>
      ) : (
        <View style={styles.headerRow}>
          <Text style={unclaimed ? styles.nameUnclaimed : styles.name}>{household.name ?? 'Unclaimed code'}</Text>
          <View style={styles.headerActions}>
            <Text style={styles.headerLink} onPress={() => setRenaming(true)}>Rename</Text>
            <Text style={styles.headerLinkDanger} onPress={confirmDelete}>Delete</Text>
          </View>
        </View>
      )}

      <View style={styles.codeRow}>
        <Text style={styles.codeText}>
          Family code: <Text style={styles.codeValue}>{household.code}</Text>
        </Text>
        <Text style={styles.headerLink} onPress={confirmRegenerateCode}>Regenerate</Text>
      </View>

      {members.length === 0 && dependents.length === 0 ? (
        <Text style={styles.emptyText}>{unclaimed ? 'Nobody has used this code yet.' : 'No one assigned to this family yet.'}</Text>
      ) : (
        <>
          {members.map((m) => (
            <View key={m.id} style={styles.personRow}>
              <Text style={styles.personName}>{m.full_name}</Text>
              <Text style={styles.removeLink} onPress={() => removeMember(m.id)}>Remove</Text>
            </View>
          ))}
          {dependents.map((d) => (
            <View key={d.id} style={styles.personRow}>
              <Ionicons name="body-outline" size={13} color={colors.muted} />
              <Text style={styles.personName}>{d.full_name}</Text>
              <Text style={styles.removeLink} onPress={() => removeDependent(d.id)}>Remove</Text>
            </View>
          ))}
        </>
      )}
    </View>
  )
}
