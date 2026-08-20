import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingTop: 56, paddingBottom: 36, paddingHorizontal: 24 },
  halo: { width: 108, height: 108, borderRadius: 54, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  logo: { width: 78, height: 78 },
  seasonPill: { backgroundColor: 'rgba(128,128,128,0.22)', borderRadius: 99, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 10 },
  seasonPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  heroTitle: { fontSize: 26, fontWeight: '700', textAlign: 'center' },
  heroTagline: { fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 4, opacity: 0.9 },
  heroNext: { fontSize: 12.5, textAlign: 'center', marginTop: 16, opacity: 0.85 },
  heroButtons: { flexDirection: 'row', gap: 12, marginTop: 24, width: '100%', maxWidth: 360 },
  body: { padding: 20, gap: 4 },
  featureTitle: { fontSize: 15, fontWeight: '700', color: colors.g800, marginBottom: 4 },
  featureBody: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  footer: { textAlign: 'center', fontSize: 11.5, color: colors.muted, marginTop: 12, marginBottom: 28 },
})
