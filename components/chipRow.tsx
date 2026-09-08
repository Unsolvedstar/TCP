import { Text, View } from 'react-native'
import { Chip } from './ui'
import { colors } from '../theme'

export type ChipOption = { value: string; label: string; color?: string }

/** A wrapped row of tap-to-select chips — the "optional, clickable" alternative to a dropdown. */
export function ChipRow({
  label,
  options,
  value,
  onChange,
  allowDeselect = true,
}: {
  label?: string
  options: ChipOption[]
  value: string
  onChange: (v: string) => void
  allowDeselect?: boolean
}) {
  return (
    <View style={{ gap: 5 }}>
      {label ? <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            color={o.color ?? colors.g700}
            selected={value === o.value}
            onPress={() => onChange(value === o.value && allowDeselect ? '' : o.value)}
          />
        ))}
      </View>
    </View>
  )
}
