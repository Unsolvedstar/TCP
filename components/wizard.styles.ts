import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  dotsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  dotWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.warmBorder, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dotCurrent: { borderColor: colors.g700, backgroundColor: colors.g50 },
  dotDone: { borderColor: colors.g700, backgroundColor: colors.g700 },
  dotText: { fontSize: 11.5, fontWeight: '800', color: colors.muted },
  dotTextActive: { color: colors.g700 },
  dotLine: { flex: 1, height: 2, backgroundColor: colors.warmBorder, marginHorizontal: 4 },
  dotLineDone: { backgroundColor: colors.g700 },
  stepCount: { fontSize: 10.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.muted },
  stepTitle: { fontSize: 17, fontWeight: '700', color: colors.g800, marginTop: 3 },
  stepSubtitle: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  error: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, color: colors.danger, fontSize: 13, padding: 10, borderRadius: radius.md, marginTop: 12 },
  body: { marginTop: 16, gap: 14 },
  nav: { flexDirection: 'row', gap: 10, marginTop: 22 },
})
