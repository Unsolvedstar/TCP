import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  modalHeading: { fontSize: 19, fontWeight: '700', color: colors.g800, marginBottom: 6 },
  guardianNote: { fontSize: 12.5, color: colors.muted, marginBottom: 18 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warmBorder, paddingVertical: 10, paddingHorizontal: 14 },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  recordBox: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warmBorder, padding: 12, marginBottom: 18, gap: 4 },
  recordTitle: { fontSize: 12.5, fontWeight: '700', color: colors.g800 },
  recordText: { fontSize: 12, color: colors.muted },
})
