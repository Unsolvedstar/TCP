import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useIsWide } from '../lib/layout'

/**
 * Two side-by-side columns on wide screens; the same two stacks one after the
 * other on a phone, so a screen's reading order doesn't change when it's
 * narrow. Each column's own children keep their vertical rhythm.
 */
export function Columns({ left, right, gap = 16 }: { left: ReactNode; right: ReactNode; gap?: number }) {
  const wide = useIsWide()
  if (!wide) {
    return (
      <>
        {left}
        {right}
      </>
    )
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap }}>
      <View style={{ flex: 1, minWidth: 0 }}>{left}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{right}</View>
    </View>
  )
}
