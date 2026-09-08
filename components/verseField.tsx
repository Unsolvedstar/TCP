import { useState } from 'react'
import { Text, View } from 'react-native'
import { Button, Field } from './ui'
import { fetchVerse } from '../lib/bibleVerse'
import { styles } from './verseField.styles'

/**
 * Labeled Bible-verse picker for a certificate detail form: a reference input
 * with a "Look Up" button that fills the verse text via bible-api.com, plus
 * a freely-editable multiline text input for the verse itself. Manual entry
 * always works — the lookup is only a convenience, and a failed lookup never
 * locks the inputs.
 */
export function VerseField({
  reference,
  text,
  onChangeReference,
  onChangeText,
}: {
  reference: string
  text: string
  onChangeReference: (v: string) => void
  onChangeText: (v: string) => void
}) {
  const [looking, setLooking] = useState(false)
  const [notFound, setNotFound] = useState(false)

  async function lookUp() {
    if (!reference.trim()) return
    setLooking(true)
    setNotFound(false)
    const found = await fetchVerse(reference)
    setLooking(false)
    if (!found) {
      setNotFound(true)
      return
    }
    onChangeReference(found.reference)
    onChangeText(found.text)
  }

  return (
    <View style={styles.container}>
      <View style={styles.lookupRow}>
        <View style={styles.referenceField}>
          <Field label="Verse reference" value={reference} onChangeText={onChangeReference} placeholder="e.g. Romans 12:2" />
        </View>
        <View style={styles.lookupBtn}>
          <Button title="Look Up" variant="secondary" onPress={lookUp} loading={looking} disabled={!reference.trim()} />
        </View>
      </View>
      {notFound ? <Text style={styles.hint}>Couldn't find that verse — you can type it in yourself.</Text> : null}
      <Field
        label="Verse text"
        value={text}
        onChangeText={onChangeText}
        placeholder="The verse text will appear here after a lookup, or type it yourself"
        multiline
        numberOfLines={3}
      />
    </View>
  )
}
