import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.g800 },
  cardSub: { fontSize: 12.5, color: colors.muted, marginBottom: 14, marginTop: 2 },
  familyName: { fontSize: 15, fontWeight: '700', color: colors.g800, marginBottom: 6 },
  codeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.g50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.g100, paddingVertical: 10, paddingHorizontal: 14 },
  codeLabel: { fontSize: 12, color: colors.muted },
  codeValue: { fontSize: 16, fontWeight: '700', color: colors.g800, letterSpacing: 2 },
  familyCodeHint: { fontSize: 11, color: colors.muted, marginTop: 6 },
  joinForm: { gap: 12, marginTop: 4 },
  nudgeBox: { marginTop: 12, gap: 10, backgroundColor: colors.g50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.g100, padding: 14 },
  nudgeText: { fontSize: 12.5, color: colors.g800 },
  nudgeActions: { flexDirection: 'row', gap: 10 },
  resultRow: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.g100, borderRadius: radius.md },
  resultText: { fontSize: 13.5, color: colors.g800, fontWeight: '600' },
  resultSub: { fontSize: 11.5, color: colors.muted, marginTop: 1 },
})
