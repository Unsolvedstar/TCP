import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.cream },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  info: { fontSize: 11.5, color: colors.muted, marginTop: 2, lineHeight: 15 },
  tapHint: { fontSize: 11, color: colors.g700, fontWeight: '700', marginTop: 3 },
  count: { fontSize: 15, fontWeight: '800', color: colors.g800, minWidth: 24, textAlign: 'right' },
})
