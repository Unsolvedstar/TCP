import { useState } from 'react'
import { Text, View } from 'react-native'
import { Alert } from '../lib/alert'
import { Button, GlassSheen, glassBlur } from './ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth-context'
import { colors, radius } from '../theme'

export function MembershipCheckInBanner() {
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const [answeredLeft, setAnsweredLeft] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  async function respond(stillHere: boolean) {
    setBusy(stillHere ? 'yes' : 'no')
    const { error } = await supabase.rpc(stillHere ? 'confirm_still_member' : 'self_report_left')
    setBusy(null)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    if (stillHere) {
      await refreshProfile()
    } else {
      setAnsweredLeft(true)
    }
  }

  if (dismissed) return null

  return (
    <View style={[styles.card, glassBlur]}>
      <GlassSheen cornerRadius={radius.md} />
      {answeredLeft ? (
        <Text style={styles.text}>Thanks for letting us know — someone from the parish office may reach out.</Text>
      ) : (
        <>
          <Text style={styles.title}>Still part of ELCSA Tshwane City Parish?</Text>
          <Text style={styles.text}>Once a year we check in, just so our records reflect who still considers this their church home.</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button title="Yes, still here" onPress={() => respond(true)} loading={busy === 'yes'} disabled={busy === 'no'} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="I've left" variant="secondary" onPress={() => respond(false)} loading={busy === 'no'} disabled={busy === 'yes'} />
            </View>
          </View>
          <Text style={styles.snooze} onPress={() => setDismissed(true)}>
            Ask me later
          </Text>
        </>
      )}
    </View>
  )
}

const styles = {
  card: {
    backgroundColor: colors.goldBg,
    borderWidth: 1,
    borderColor: '#f0e0a8',
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  title: { fontSize: 14.5, fontWeight: '700' as const, color: colors.g800 },
  text: { fontSize: 12.5, color: '#6b5a10', lineHeight: 18 },
  row: { flexDirection: 'row' as const, gap: 8, marginTop: 4 },
  snooze: { fontSize: 11.5, color: colors.muted, textAlign: 'center' as const, marginTop: 2 },
}
