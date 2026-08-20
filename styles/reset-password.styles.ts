import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    padding: 22,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  checkingBox: { paddingVertical: 24, alignItems: 'center' },
  error: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.dangerBorder, color: colors.danger, fontSize: 13, padding: 10, borderRadius: radius.md },
  notice: { backgroundColor: colors.g50, borderWidth: 1, borderColor: colors.g100, color: colors.g700, fontSize: 13, padding: 10, borderRadius: radius.md },
})
