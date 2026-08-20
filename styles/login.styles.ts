import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    padding: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.g800, marginBottom: 2 },
  error: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, color: colors.danger, fontSize: 13, padding: 10, borderRadius: radius.md },
  notice: { backgroundColor: colors.g50, borderWidth: 1, borderColor: colors.g100, color: colors.g700, fontSize: 13, padding: 10, borderRadius: radius.md },
  hint: { fontSize: 11.5, color: colors.muted, textAlign: 'center', lineHeight: 17, marginTop: 4 },
  registerLink: { textAlign: 'center', color: colors.g700, fontWeight: '700', fontSize: 13.5, marginTop: 20 },
  forgotLink: { textAlign: 'center', color: colors.g700, fontWeight: '700', fontSize: 12.5 },
})
