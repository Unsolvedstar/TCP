import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: '700', color: colors.g800, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  box: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warmBorder, padding: 14, marginBottom: 14, gap: 4 },
  boxTitle: { fontSize: 12.5, fontWeight: '700', color: colors.g800, marginBottom: 4 },
  boxText: { fontSize: 13.5, color: colors.text },
  boxSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  certThumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.g50 },
  certLink: { fontSize: 12, color: colors.g700, fontWeight: '700', textDecorationLine: 'underline', marginTop: 4 },
})
