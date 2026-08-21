import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius } from '../theme'

// react-native-web's own Alert.alert is a no-op stub (`static alert() {}`) —
// it never shows anything, so every confirmation dialog and error message in
// the app silently did nothing on web. This re-implements the same
// `Alert.alert(title, message, buttons)` signature as a real on-screen modal,
// so every existing call site works unchanged — only the import moves from
// 'react-native' to here.

type AlertButton = { text?: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }
type AlertState = { title: string; message?: string; buttons: AlertButton[] } | null

let setHostState: ((state: AlertState) => void) | null = null

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    const resolvedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }]
    if (!setHostState) {
      // AlertHost isn't mounted yet (shouldn't happen once wired into the
      // root layout) — fail loud in dev rather than silently swallowing,
      // which is exactly the bug this file exists to fix.
      console.error('Alert.alert called before <AlertHost /> mounted:', title, message)
      return
    }
    setHostState({ title, message, buttons: resolvedButtons })
  },
}

export function AlertHost() {
  const [state, setState] = useState<AlertState>(null)

  useEffect(() => {
    setHostState = setState
    return () => {
      setHostState = null
    }
  }, [])

  if (!state) return null

  function press(btn: AlertButton) {
    setState(null)
    btn.onPress?.()
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setState(null)}>
      <Pressable style={styles.backdrop} onPress={() => setState(null)}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{state.title}</Text>
          {state.message ? <Text style={styles.message}>{state.message}</Text> : null}
          <View style={styles.buttonRow}>
            {state.buttons.map((btn, i) => (
              <Pressable
                key={i}
                onPress={() => press(btn)}
                style={({ pressed }) => [styles.button, btn.style === 'cancel' && styles.buttonCancel, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.buttonText, btn.style === 'destructive' && styles.buttonTextDestructive, btn.style === 'cancel' && styles.buttonTextCancel]}>
                  {btn.text ?? 'OK'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    padding: 20,
    width: '100%',
    maxWidth: 380,
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.g800, marginBottom: 6 },
  message: { fontSize: 14, color: colors.text, lineHeight: 20 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  button: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.md },
  buttonCancel: { backgroundColor: colors.cream },
  buttonText: { fontSize: 14, fontWeight: '700', color: colors.g700 },
  buttonTextDestructive: { color: colors.danger },
  buttonTextCancel: { color: colors.muted, fontWeight: '600' },
})
