import { createElement, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, radius } from '../theme'
import { toLocalISODate } from '../lib/dates'
import { styles, webDateInputStyle } from './ui.styles'

export function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
}

// A real CSS blur behind translucent panels, only meaningful (and only
// understood) on web — react-native-web passes unrecognized style keys like
// backdropFilter straight through to the DOM, but native platforms have no
// such property, so it's kept out of the typed StyleSheet.create() styles
// below and merged in only for web.
export const glassBlur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as object) : null

// The glossy highlight that sells the "glass bubble" look — a soft white sheen
// across the top of a panel, like light catching a curved glass or water
// surface. Render as the first child of anything using the glass treatment;
// it carries its own matching borderRadius so it clips itself without the
// parent needing `overflow: hidden` (which would also clip the card's shadow).
export function GlassSheen({ cornerRadius = radius.lg }: { cornerRadius?: number } = {}) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 0.75 }}
      style={[StyleSheet.absoluteFill, { borderRadius: cornerRadius }]}
    />
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <View style={[styles.card, glassBlur, style]}>
      <GlassSheen />
      {children}
    </View>
  )
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.screenTitle}>{title}</Text>
      {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>
}

export function Chip({ label, color, onPress, selected }: { label: string; color: string; onPress?: () => void; selected?: boolean }) {
  const body = (
    <View
      style={[
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : { backgroundColor: color + '26', borderColor: color + '55' },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.white : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
  return onPress ? <Pressable onPress={onPress} hitSlop={4}>{body}</Pressable> : body
}

export function BarRow({ label, sub, value, max, color }: { label: string; sub?: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelCol}>
        <Text style={styles.barLabel} numberOfLines={1}>
          {label}
        </Text>
        {sub ? <Text style={styles.barSub}>{sub}</Text> : null}
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  )
}

export function Field({ label, ...rest }: { label: string } & TextInputProps) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor="#a99" style={styles.input} {...rest} />
    </View>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={{ fontSize: 15, color: current ? colors.text : '#a99' }}>{current ? current.label : placeholder}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={[styles.modalSheet, glassBlur]}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalOption, item.value === value && styles.modalOptionActive]}
                  onPress={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.modalOptionText, item.value === value && styles.modalOptionTextActive]}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  )
}

export function DateField({
  label,
  value,
  onChange,
  maximumDate,
  placeholder = 'Select date…',
}: {
  label: string
  value: string | null
  onChange: (isoDate: string) => void
  maximumDate?: Date
  placeholder?: string
}) {
  const [iosOpen, setIosOpen] = useState(false)
  const current = value ? new Date(value + 'T00:00:00') : new Date(2010, 0, 1)

  if (Platform.OS === 'web') {
    // @react-native-community/datetimepicker has no web implementation (it renders null there),
    // so on web we drop straight to the browser's native <input type="date">.
    return (
      <View style={{ gap: 5 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {createElement('input', {
          type: 'date',
          value: value ?? '',
          max: maximumDate ? toLocalISODate(maximumDate) : undefined,
          placeholder,
          onChange: (e: any) => {
            if (e.target.value) onChange(e.target.value)
          },
          style: webDateInputStyle,
        })}
      </View>
    )
  }

  function open() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate,
        onChange: (_event, selected) => {
          if (selected) onChange(toLocalISODate(selected))
        },
      })
    } else {
      setIosOpen(true)
    }
  }

  return (
    <View style={{ gap: 5 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable style={styles.input} onPress={open}>
        <Text style={{ fontSize: 15, color: value ? colors.text : '#a99' }}>{value ? formatDate(value) : placeholder}</Text>
      </Pressable>
      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIosOpen(false)}>
            <View style={[styles.modalSheet, glassBlur]}>
              <Text style={styles.modalTitle}>{label}</Text>
              <DateTimePicker
                value={current}
                mode="date"
                display="spinner"
                maximumDate={maximumDate}
                onChange={(_event, selected) => {
                  if (selected) onChange(toLocalISODate(selected))
                }}
              />
              <View style={{ padding: 16 }}>
                <Button title="Done" onPress={() => setIosOpen(false)} />
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  )
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'danger'
  loading?: boolean
  disabled?: boolean
}) {
  const bg = variant === 'primary' ? colors.g700 : variant === 'danger' ? colors.white : colors.white
  const border = variant === 'danger' ? colors.dangerBorder : variant === 'secondary' ? colors.warmBorder : colors.g700
  const textColor = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.g700
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  )
}
