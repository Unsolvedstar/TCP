import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native'
import { colors } from '../theme'

// Soft drifting particles layered over the whole app. Purely decorative: it
// ignores touches, stays faint so text remains readable, and switches itself
// off when the device asks for reduced motion.

const PARTICLE_COLORS = [colors.gold2, colors.sun, colors.mint, colors.g500, colors.sky, colors.white]
const COUNT = 18

type Particle = {
  left: number // fraction of width
  size: number
  color: string
  duration: number
  delay: number
  sway: number
  peak: number // max opacity
}

// Seeded so the layout is stable between renders instead of reshuffling.
function makeParticles(): Particle[] {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: COUNT }, (_, i) => ({
    left: rand(),
    size: 4 + rand() * 9,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    duration: 9000 + rand() * 9000,
    delay: rand() * 8000,
    sway: 14 + rand() * 26,
    peak: 0.25 + rand() * 0.3,
  }))
}

function ParticleDot({ p, height }: { p: Particle; height: number }) {
  const progress = useRef(new Animated.Value(0)).current
  const native = Platform.OS !== 'web'

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(p.delay),
        Animated.timing(progress, { toValue: 1, duration: p.duration, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: native }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [progress, p, native])

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height + 20, -40] })
  const translateX = progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, p.sway, 0, -p.sway, 0] })
  const opacity = progress.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, p.peak, p.peak, 0] })

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${p.left * 100}%`,
        top: 0,
        width: p.size,
        height: p.size,
        borderRadius: p.size / 2,
        backgroundColor: p.color,
        opacity,
        transform: [{ translateY }, { translateX }],
      }}
    />
  )
}

export function FloatingParticles() {
  const { height } = useWindowDimensions()
  const particles = useMemo(makeParticles, [])
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {})
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => sub.remove()
  }, [])

  if (reduceMotion) return null

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <ParticleDot key={i} p={p} height={height} />
      ))}
    </View>
  )
}
