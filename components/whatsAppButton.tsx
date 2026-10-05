import { Linking, Pressable, StyleSheet, Text } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Alert } from '../lib/alert'
import { whatsAppUrl } from '../lib/whatsapp'

const WHATSAPP_GREEN = '#25D366'

// The familiar green "message on WhatsApp" button. Renders nothing when the
// number can't be turned into a WhatsApp link.
export function WhatsAppButton({ phone, message, label = 'WhatsApp' }: { phone: string | null | undefined; message?: string; label?: string }) {
  const url = whatsAppUrl(phone, message)
  if (!url) return null

  async function open() {
    try {
      await Linking.openURL(url as string)
    } catch {
      Alert.alert('Could not open WhatsApp', 'Make sure WhatsApp is installed, or try again.')
    }
  }

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Message ${label}`} style={styles.btn}>
      <Ionicons name="logo-whatsapp" size={16} color="#fff" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: WHATSAPP_GREEN, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 99 },
  label: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
})
