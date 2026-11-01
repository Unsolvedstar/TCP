import { createElement, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import { colors, radius } from '../theme'
import { toLocalISODate } from '../lib/dates'
import { Alert } from '../lib/alert'
import { styles, webDateInputStyle } from './ui.styles'

export function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
}

// A real CSS blur behind translucent panels, only meaningful (and only
// understood) on web — react-native-web passes unrecognized style keys like
// backdropFilter straight through to the DOM, but native platforms have no
// such property, so it's kept out of the typed StyleSheet.create() styles
// below and merged in only for web.
// Background blur looks nice on a desktop browser but makes scrolling shake and stutter on phones and
// tablets, where the cards are nearly opaque anyway — so only use it with a mouse/trackpad.
const canBlur = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches
export const glassBlur = canBlur ? ({ backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' } as object) : null

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

// Soft translucent bubbles + a light gradient over a hero banner so it reads
// as friendly rather than a flat slab of colour. The parent hero needs
// overflow: 'hidden' (set in each screen's hero style) to clip the circles.
export function HeroDecor() {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: colors.sun, opacity: 0.35 }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: -34, right: 60, width: 90, height: 90, borderRadius: 45, backgroundColor: colors.mint, opacity: 0.3 }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 30, right: 110, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, opacity: 0.25 }} />
    </>
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

export function Chip({ label, color, onPress, selected, icon }: { label: string; color: string; onPress?: () => void; selected?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const body = (
    <View
      style={[
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : { backgroundColor: color + '26', borderColor: color + '55' },
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={selected ? colors.white : color} /> : null}
      <Text style={[styles.chipText, { color: selected ? colors.white : color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }} hitSlop={4}>{body}</Pressable> : body
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

// A small tap-to-copy icon for a value shown elsewhere in the row (a family
// code, an account number) — flips to a checkmark for 1.5s as feedback since
// there's no toast component in the app, then reverts on its own.
export function CopyButton({ value, size = 17 }: { value: string; size?: number }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await Clipboard.setStringAsync(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Pressable onPress={copy} accessibilityRole="button" accessibilityLabel={copied ? 'Copied' : 'Copy to clipboard'} hitSlop={10}>
      <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={size} color={copied ? colors.g700 : colors.muted} />
    </Pressable>
  )
}

export function Field({ label, error, prefix, onFocus, onBlur, style, ...rest }: { label: string; error?: boolean; prefix?: string } & TextInputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused, error && styles.inputError]}>
        {prefix ? <Text style={styles.inputPrefix}>{prefix}</Text> : null}
        <TextInput
          placeholderTextColor="#b3a99b"
          style={[styles.inputText, style]}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          {...rest}
        />
      </View>
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
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} style={[styles.inputWrap, open && styles.inputFocused, { justifyContent: 'space-between', paddingHorizontal: 14 }]} onPress={() => setOpen(true)}>
        <Text style={{ flex: 1, fontSize: 15, color: current ? colors.text : '#b3a99b' }} numberOfLines={1}>{current ? current.label : placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
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
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: item.value === value }}
                  style={[styles.modalOption, item.value === value && styles.modalOptionActive]}
                  onPress={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.modalOptionText, item.value === value && styles.modalOptionTextActive]}>{item.label}</Text>
                  {item.value === value ? <Ionicons name="checkmark" size={18} color={colors.g700} /> : null}
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
  const [webFocused, setWebFocused] = useState(false)
  const current = value ? new Date(value + 'T00:00:00') : new Date(2010, 0, 1)

  if (Platform.OS === 'web') {
    // @react-native-community/datetimepicker has no web implementation (it renders null there),
    // so on web we drop straight to the browser's native <input type="date">.
    return (
      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={[styles.inputWrap, webFocused && styles.inputFocused]}>
          {createElement('input', {
            type: 'date',
            value: value ?? '',
            max: maximumDate ? toLocalISODate(maximumDate) : undefined,
            placeholder,
            onChange: (e: any) => {
              if (e.target.value) onChange(e.target.value)
            },
            onFocus: () => setWebFocused(true),
            onBlur: () => setWebFocused(false),
            style: webDateInputStyle,
          })}
        </View>
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
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} style={[styles.inputWrap, { justifyContent: 'space-between', paddingHorizontal: 14 }]} onPress={open}>
        <Text style={{ flex: 1, fontSize: 15, color: value ? colors.text : '#b3a99b' }}>{value ? formatDate(value) : placeholder}</Text>
        <Ionicons name="calendar-outline" size={18} color={colors.muted} />
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

// Guards every button in the app: ignores re-taps while an async handler is
// still running (double-submits), and turns a rejected handler into an alert
// instead of an unhandled promise rejection.
function useGuardedPress(onPress: () => void | Promise<unknown>, label: string) {
  const inFlight = useRef(false)
  return async function handlePress() {
    if (inFlight.current) return
    inFlight.current = true
    try {
      await onPress()
    } catch (e) {
      console.error(`Button "${label}" handler failed`, e)
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      inFlight.current = false
    }
  }
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  inverse,
}: {
  title: string
  onPress: () => void | Promise<unknown>
  variant?: 'primary' | 'secondary' | 'danger' | 'back'
  loading?: boolean
  disabled?: boolean
  // For buttons sitting on a coloured banner: fills the button with `background`
  // and writes the label in `text`, so it can never blend into the banner colour
  // (pass the banner's own text colour as `background` and its fill as `text`).
  inverse?: { background: string; text: string }
}) {
  const handlePress = useGuardedPress(onPress, title)
  // 'back' is a tinted green fill with a solid green border, so it stands out on
  // both the cream page and white cards (plain white 'secondary' blends into them).
  let bg = variant === 'primary' ? colors.g700 : variant === 'back' ? colors.g100 : colors.white
  let border = variant === 'danger' ? colors.dangerBorder : variant === 'secondary' ? colors.warmBorder : colors.g700
  let textColor = variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.g700
  if (inverse) {
    bg = inverse.background
    border = inverse.background
    textColor = inverse.text
  }
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && !disabled && styles.btnPrimaryShadow,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.btnText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  )
}

type ActionTone = 'primary' | 'danger' | 'neutral'

// Small button for row/card actions (Approve, Remove, View Certificate, Edit…).
// Always drawn as a bordered button — never bare text — with hover, pressed and
// keyboard-focus states, and the same double-tap guard as <Button>.
const ACTION_TONES: Record<ActionTone, { bg: string; hover: string; pressed: string; border: string; text: string }> = {
  primary: { bg: colors.g700, hover: colors.g800, pressed: colors.g900, border: colors.g700, text: colors.white },
  danger: { bg: colors.white, hover: colors.dangerBg, pressed: colors.dangerBg, border: colors.dangerBorder, text: colors.danger },
  neutral: { bg: colors.white, hover: colors.g50, pressed: colors.g100, border: colors.g700, text: colors.g700 },
}

export function ActionButton({
  label,
  onPress,
  tone = 'neutral',
  disabled = false,
  accessibilityLabel,
  style,
}: {
  label: string
  onPress: () => void | Promise<unknown>
  tone?: ActionTone
  disabled?: boolean
  // For when the visible label alone is ambiguous, e.g. a bare "Remove" in a list of people.
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
}) {
  const handlePress = useGuardedPress(onPress, label)
  const t = ACTION_TONES[tone]
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed, hovered }: HoverablePressableState) => [
        styles.actionBtn,
        { backgroundColor: pressed ? t.pressed : hovered ? t.hover : t.bg, borderColor: t.border, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <Text style={[styles.actionBtnText, { color: t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

// react-native-web passes `hovered` to Pressable style callbacks; RN's own types don't list it.
type HoverablePressableState = { pressed: boolean; hovered?: boolean }

// One option of a segmented switcher (Dashboard | Leagues | Calendar), filling its share of the row.
export function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      style={({ pressed, hovered }: HoverablePressableState) => [
        styles.tabButton,
        active ? styles.tabButtonActive : hovered || pressed ? styles.tabButtonHover : null,
      ]}
    >
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

// A pill toggle for filter lists (activity filters); several can sit in a wrapping row.
export function ChipButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      style={({ pressed, hovered }: HoverablePressableState) => [styles.chipButton, active ? styles.chipButtonActive : hovered || pressed ? styles.chipButtonHover : null]}
    >
      <Text style={[styles.chipButtonText, active && styles.chipButtonTextActive]}>{label}</Text>
    </Pressable>
  )
}

// One choice in a pick-one list (e.g. which league): a full-width bordered row
// that shows as selected once chosen.
export function OptionButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed, hovered }: HoverablePressableState) => [styles.optionButton, selected ? styles.optionButtonActive : hovered || pressed ? styles.optionButtonHover : null]}
    >
      <Text style={[styles.optionButtonText, selected && styles.optionButtonTextActive]}>{label}</Text>
    </Pressable>
  )
}
