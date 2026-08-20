import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 20 },
  halo: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  logo: { width: 66, height: 66 },
  seasonPill: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10, marginBottom: 8 },
  seasonPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 19, fontWeight: '700', color: colors.g800, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginTop: 4 },
})
