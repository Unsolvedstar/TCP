import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    padding: 22,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.g800 },
  cardBody: { fontSize: 13, color: colors.muted, lineHeight: 19, marginBottom: 6 },
  backLink: { textAlign: 'center', color: colors.g700, fontWeight: '700', fontSize: 13.5, marginTop: 6 },
})
