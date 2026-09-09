import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, padding: 24, gap: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    padding: 16,
  },
  logoWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: 34, height: 34 },
  dot: { width: 48, height: 48, borderRadius: 24 },
  name: { fontSize: 15, fontWeight: '700', color: colors.g800 },
  tagline: { fontSize: 12, color: colors.muted, marginTop: 2 },
  arrow: { fontSize: 15, fontWeight: '700', color: colors.g700 },
  empty: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 24 },
  error: { color: colors.danger, textAlign: 'center', marginTop: 24 },
  backLink: { textAlign: 'center', color: colors.g700, fontWeight: '700', fontSize: 13.5, marginTop: 6 },
})
