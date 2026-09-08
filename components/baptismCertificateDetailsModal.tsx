import { useState } from 'react'
import { Modal, ScrollView, Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import { Button, Field } from './ui'
import { VerseField } from './verseField'
import { styles } from './editModal.styles'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'
import type { BaptismApplication } from '../lib/types'

/**
 * Admin-only editor for the extra detail a baptism certificate needs beyond
 * what's already captured at request/registration time (register number,
 * diocese, parents, birth place, and an optional Bible verse) — see
 * supabase/migrations/0022_certificate_details.sql. Used from
 * MemberProfileModal (profiles) and EditChildModal (dependents); both of
 * those are only ever reached from the admin-only Members screen, so no
 * separate admin check is needed here.
 *
 * Saving always overwrites all six fields (the RPC does a full replace, not
 * a partial merge — see the migration comment), so this form's initial
 * values come straight from whatever's already on the record.
 */
export function BaptismCertificateDetailsModal({
  targetId,
  isDependent,
  name,
  application,
  onClose,
  onSaved,
}: {
  targetId: string
  isDependent: boolean
  name: string
  application: BaptismApplication | null | undefined
  onClose: () => void
  onSaved: () => void
}) {
  const [registerNo, setRegisterNo] = useState(application?.register_no ?? '')
  const [diocese, setDiocese] = useState(application?.diocese ?? '')
  const [parents, setParents] = useState(application?.parents ?? '')
  const [birthPlace, setBirthPlace] = useState(application?.birth_place ?? '')
  const [verseReference, setVerseReference] = useState(application?.verse_reference ?? '')
  const [verseText, setVerseText] = useState(application?.verse_text ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase.rpc('admin_set_baptism_certificate_details', {
      target_id: targetId,
      p_is_dependent: isDependent,
      p_register_no: registerNo.trim(),
      p_diocese: diocese.trim(),
      p_parents: parents.trim(),
      p_birth_place: birthPlace.trim(),
      p_verse_reference: verseReference.trim(),
      p_verse_text: verseText.trim(),
    })
    setSaving(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    onSaved()
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        <Text style={styles.modalHeading}>Baptism Certificate Details</Text>
        <Text style={styles.guardianNote}>{name}</Text>
        <View style={{ gap: 12 }}>
          <Field label="Register No." value={registerNo} onChangeText={setRegisterNo} placeholder="e.g. 123/2026" />
          <Field label="Diocese" value={diocese} onChangeText={setDiocese} placeholder="e.g. Central Diocese" />
          <Field label="Birth Place" value={birthPlace} onChangeText={setBirthPlace} placeholder="e.g. Pretoria" />
          <Field label="Parents" value={parents} onChangeText={setParents} placeholder="e.g. Asivhathu Tshikovhi & Lufuno Tshikovhi" />
          <VerseField reference={verseReference} text={verseText} onChangeReference={setVerseReference} onChangeText={setVerseText} />
        </View>
        <View style={{ gap: 10, marginTop: 20 }}>
          <Button title="Save" onPress={save} loading={saving} />
          <Button title="Cancel" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  )
}
