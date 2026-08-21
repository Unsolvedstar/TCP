import { useState } from 'react'
import { Image, Platform, Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import * as ImagePicker from 'expo-image-picker'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import { Button } from './ui'
import { styles } from './certificate-picker.styles'

/**
 * Lets someone attach a photo of a certificate (baptism/confirmation) to a
 * request. Picked images are resized/compressed client-side before being
 * stored as a data URI — same reasoning as the signature pad: a parish this
 * size doesn't need Supabase Storage stood up just for this, as long as the
 * image is kept small (~1000px wide, JPEG) rather than a full-resolution
 * phone photo.
 */
export function CertificatePicker({ label, value, onChange }: { label: string; value: string | null; onChange: (dataUri: string | null) => void }) {
  const [busy, setBusy] = useState(false)

  async function processAndSet(uri: string) {
    setBusy(true)
    try {
      const result = await manipulateAsync(uri, [{ resize: { width: 1000 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true })
      if (result.base64) onChange(`data:image/jpeg;base64,${result.base64}`)
    } catch (e: any) {
      Alert.alert('Could not attach photo', e?.message ?? 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow photo access to attach a certificate.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 })
    if (!result.canceled && result.assets[0]) await processAndSet(result.assets[0].uri)
  }

  async function takePhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Please allow camera access to photograph a certificate.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled && result.assets[0]) await processAndSet(result.assets[0].uri)
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {value ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: value }} style={styles.preview} />
          <Text style={styles.removeLink} onPress={() => onChange(null)}>
            Remove
          </Text>
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <View style={{ flex: 1 }}>
            <Button title="Choose Photo" variant="secondary" loading={busy} onPress={pickFromLibrary} />
          </View>
          {Platform.OS !== 'web' ? (
            <View style={{ flex: 1 }}>
              <Button title="Take Photo" variant="secondary" loading={busy} onPress={takePhoto} />
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}
