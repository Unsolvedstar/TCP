import { createElement, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { colors } from '../theme'
import { toLocalISODate } from '../lib/dates'
import { styles, webDateInputStyle } from './ui.styles'

export function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>
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

export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: color + '18' }]}>
      <View style={[styles.chipDot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
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
          <View style={styles.modalSheet}>
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
            <View style={styles.modalSheet}>
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
