import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.cream, borderRadius: radius.md, padding: 12, marginTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.g800 },
  sub: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
  // Looks like the button it is (the whole header row is the pressable); a bordered pill, not a bare word.
  expandLink: { fontSize: 12.5, fontWeight: '700', color: colors.g700, borderWidth: 1, borderColor: colors.g700, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 12, overflow: 'hidden', backgroundColor: colors.white },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  expandedBody: { marginTop: 10, gap: 4 },
  actionRow: { borderBottomWidth: 1, borderBottomColor: colors.warmBorder, paddingVertical: 12, gap: 8 },
  actionLabel: { fontSize: 12.5, fontWeight: '700', color: colors.g800 },
  hint: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
})
