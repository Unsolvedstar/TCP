import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import * as Speech from 'expo-speech'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius } from '../theme'

// Reads `text` aloud with the device's text-to-speech voice (Web Speech API on
// the web build). Tap again to stop. Starting a new one stops whatever was
// already speaking, so two buttons never talk over each other.

export function SpeakButton({ text, label = 'Listen' }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false)

  // Leaving the screen shouldn't leave the phone talking.
  useEffect(() => () => void Speech.stop(), [])

  async function toggle() {
    if (speaking) {
      await Speech.stop()
      setSpeaking(false)
      return
    }
    await Speech.stop()
    const spoken = text.trim().slice(0, Speech.maxSpeechInputLength - 1)
    if (!spoken) return
    setSpeaking(true)
    Speech.speak(spoken, {
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    })
  }

  if (!text.trim()) return null

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={speaking ? 'Stop reading aloud' : `${label} — read aloud`}
      style={[styles.btn, speaking && styles.btnActive]}
    >
      <Ionicons name={speaking ? 'stop-circle-outline' : 'volume-high-outline'} size={15} color={speaking ? colors.white : colors.g700} />
      <Text style={[styles.label, speaking && styles.labelActive]}>{speaking ? 'Stop' : label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.g100,
    backgroundColor: colors.g50,
  },
  btnActive: { backgroundColor: colors.g700, borderColor: colors.g700 },
  label: { fontSize: 12.5, fontWeight: '700', color: colors.g700 },
  labelActive: { color: colors.white },
})
