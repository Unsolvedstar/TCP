import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  nav: { fontSize: 22, fontWeight: '700', color: colors.g700, paddingHorizontal: 14, paddingVertical: 4 },
  monthLabel: { fontSize: 15.5, fontWeight: '700', color: colors.g800 },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 10.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 6,
    borderRadius: radius.md,
  },
  cellToday: { backgroundColor: colors.g50 },
  dayNum: { fontSize: 12.5, fontWeight: '600', color: colors.text },
  dayNumToday: { color: colors.g700, fontWeight: '800' },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  overflow: { fontSize: 8.5, fontWeight: '700', color: colors.muted },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.cream },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: 10.5, color: colors.muted, fontWeight: '600' },
  modalItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 20, paddingVertical: 10 },
  modalDot: { width: 9, height: 9, borderRadius: 5, marginTop: 4 },
  modalItemLabel: { fontSize: 13.5, fontWeight: '700', color: colors.g800 },
  modalItemDetail: { fontSize: 12, color: colors.muted, marginTop: 2 },
  emptyModalText: { fontSize: 13, color: colors.muted, paddingHorizontal: 20, paddingVertical: 16, fontStyle: 'italic' },
})
