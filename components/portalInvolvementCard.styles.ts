import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.g800 },
  cardSub: { fontSize: 12.5, color: colors.muted, marginBottom: 14, marginTop: 2 },
  actionRow: { borderBottomWidth: 1, borderBottomColor: colors.cream, paddingVertical: 14, gap: 8 },
  actionLabel: { fontSize: 13.5, fontWeight: '700', color: colors.g800 },
  actionCol: { gap: 8 },
  hintText: { fontSize: 12.5, color: colors.muted, fontStyle: 'italic' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
})
