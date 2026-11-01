import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingTop: 36, paddingBottom: 40, gap: 12 },
  updated: { fontSize: 12, color: colors.muted, textAlign: 'center', marginBottom: 4 },
  heading: { fontSize: 15, fontWeight: '800', color: colors.g800, marginBottom: 8 },
  body: { fontSize: 13.5, color: colors.text, lineHeight: 20, marginBottom: 6 },
  bulletRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: { fontSize: 13.5, color: colors.g700, lineHeight: 20 },
  bulletText: { flex: 1 },
  back: { marginTop: 8 },
})
