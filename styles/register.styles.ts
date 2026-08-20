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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  error: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, color: colors.danger, fontSize: 13, padding: 10, borderRadius: radius.md, marginBottom: 14 },
  notice: { backgroundColor: colors.g50, borderWidth: 1, borderColor: colors.g100, color: colors.g700, fontSize: 13, padding: 10, borderRadius: radius.md, marginBottom: 14 },
  backLink: { textAlign: 'center', color: colors.g700, fontWeight: '700', fontSize: 13.5, marginTop: 20 },
})
