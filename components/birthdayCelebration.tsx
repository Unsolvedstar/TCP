import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Modal, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Button } from './ui'
import { useAuth } from '../lib/authContext'
import { birthdayShownKey, firstName, isBirthdayToday, turningAge } from '../lib/birthday'
import { colors, radius } from '../theme'

const CONFETTI_COLORS = [colors.gold2, colors.sun, colors.coral, colors.sky, colors.mint, colors.brandRed, colors.white]
const PIECES = 48

type Piece = { left: number; w: number; h: number; color: string; duration: number; delay: number; drift: number; spin: number }

function makePieces(): Piece[] {
  let seed = 11
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: PIECES }, (_, i) => ({
    left: rand(),
    w: 6 + rand() * 6,
    h: 9 + rand() * 9,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    duration: 2600 + rand() * 2400,
    delay: rand() * 1400,
    drift: (rand() - 0.5) * 120,
    spin: 2 + rand() * 4,
  }))
}

function ConfettiPiece({ p, height }: { p: Piece; height: number }) {
  const t = useRef(new Animated.Value(0)).current
  const native = Platform.OS !== 'web'

  useEffect(() => {
    // A burst: each piece falls once, after a short random pause.
    const anim = Animated.sequence([
      Animated.delay(p.delay),
      Animated.timing(t, { toValue: 1, duration: p.duration, easing: Easing.in(Easing.quad), useNativeDriver: native }),
    ])
    anim.start()
    return () => anim.stop()
  }, [t, p, native])

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -30,
        left: `${p.left * 100}%`,
        width: p.w,
        height: p.h,
        borderRadius: 2,
        backgroundColor: p.color,
        opacity: t.interpolate({ inputRange: [0, 0.05, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height + 60] }) },
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin * 360}deg`] }) },
        ],
      }}
    />
  )
}

// Greets the signed-in person on their birthday: a "Happy Birthday" card with
// confetti, shown once per day. Dismissing it is remembered on the device, so
// it doesn't pop up again on every screen change or app reopen that day.
export function BirthdayCelebration() {
  const { profile } = useAuth()
  const { height } = useWindowDimensions()
  const [visible, setVisible] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)
  const pieces = useMemo(makePieces, [])

  const profileId = profile?.id
  const dob = profile?.date_of_birth

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {})
  }, [])

  useEffect(() => {
    if (!profileId || !isBirthdayToday(dob)) return
    let cancelled = false
    AsyncStorage.getItem(birthdayShownKey(profileId))
      .then((seen) => {
        if (!cancelled && !seen) setVisible(true)
      })
      .catch(() => {
        // Storage unavailable: still celebrate rather than silently skip.
        if (!cancelled) setVisible(true)
      })
    return () => {
      cancelled = true
    }
  }, [profileId, dob])

  function close() {
    setVisible(false)
    if (profileId) AsyncStorage.setItem(birthdayShownKey(profileId), '1').catch(() => {})
  }

  if (!visible || !profile) return null
  const age = dob ? turningAge(dob) : null
  const name = firstName(profile.full_name)

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        {reduceMotion ? null : (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {pieces.map((p, i) => (
              <ConfettiPiece key={i} p={p} height={height} />
            ))}
          </View>
        )}
        <View style={styles.card}>
          <Text style={styles.emoji}>🎂</Text>
          <Text style={styles.title}>Happy Birthday{name ? `, ${name}` : ''}!</Text>
          {age ? <Text style={styles.age}>Celebrating {age} years</Text> : null}
          <Text style={styles.body}>Wishing you a blessed day from all of us at Tshwane City Parish. 🎉</Text>
          <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
            <Button title="Thank you! 🙏" onPress={close} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,38,3,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.white, borderRadius: radius.xl, padding: 24, alignItems: 'center', borderTopWidth: 5, borderTopColor: colors.gold2 },
  emoji: { fontSize: 54, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800', color: colors.g800, textAlign: 'center' },
  age: { fontSize: 14, fontWeight: '700', color: colors.gold, marginTop: 4 },
  body: { fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 10 },
})
