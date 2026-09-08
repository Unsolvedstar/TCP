import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  container: { gap: 8 },
  lookupRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  referenceField: { flex: 1 },
  lookupBtn: { width: 100 },
  hint: { fontSize: 11.5, color: colors.muted, fontStyle: 'italic' },
})
