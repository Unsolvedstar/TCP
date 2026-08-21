import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { GlassSheen, glassBlur } from './ui'
import { styles as uiStyles } from './ui.styles'
import { styles as statStyles } from './stat-cards.styles'
import { colors } from '../theme'

/**
 * A Card whose body starts collapsed — the fix for screens that were one
 * long always-expanded scroll of stat cards. Replaces <Card> at the call
 * site (it renders its own card shell) rather than wrapping one.
 */
export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <View style={[uiStyles.card, glassBlur]}>
      <GlassSheen />
      <Pressable onPress={() => setOpen(!open)} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={statStyles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={[statStyles.cardSub, { marginBottom: 0 }]}>{subtitle}</Text> : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </View>
  )
}
