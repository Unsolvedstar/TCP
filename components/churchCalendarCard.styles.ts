import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.cream, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { fontSize: 13.5, color: colors.text, fontWeight: '700' },
  note: { fontSize: 11.5, color: colors.muted, marginTop: 2, fontStyle: 'italic' },
  date: { fontSize: 12, color: colors.muted, fontWeight: '600', textAlign: 'right' },
  nowBadge: {
    fontSize: 10,
    color: colors.white,
    fontWeight: '800',
    backgroundColor: colors.g700,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
})
