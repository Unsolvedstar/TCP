import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  cross: { fontSize: 32, color: colors.gold },
  title: { fontSize: 17, fontWeight: '700', color: colors.g800, textAlign: 'center' },
  message: { fontSize: 13, color: colors.muted, textAlign: 'center', marginBottom: 8 },
  btn: { width: '100%', maxWidth: 260, borderRadius: radius.md },
})
