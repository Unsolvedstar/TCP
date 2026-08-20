import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.cream, borderRadius: radius.md, padding: 12, marginTop: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14.5, fontWeight: '700', color: colors.g800 },
  sub: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
  expandLink: { fontSize: 12.5, fontWeight: '700', color: colors.g700 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  expandedBody: { marginTop: 10, gap: 4 },
  actionRow: { borderBottomWidth: 1, borderBottomColor: colors.warmBorder, paddingVertical: 12, gap: 8 },
  actionLabel: { fontSize: 12.5, fontWeight: '700', color: colors.g800 },
  hint: { fontSize: 12, color: colors.muted, fontStyle: 'italic' },
  leagueOption: { fontSize: 12.5, color: colors.text, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  leagueOptionActive: { borderColor: colors.g700, backgroundColor: colors.g50, color: colors.g700, fontWeight: '700' },
  editLink: { fontSize: 12, fontWeight: '700', color: colors.g700, paddingVertical: 10 },
})
