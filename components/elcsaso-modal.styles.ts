import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  heading: { fontSize: 19, fontWeight: '700', color: colors.g800, marginBottom: 4 },
  sub: { fontSize: 12.5, color: colors.muted, marginBottom: 18, lineHeight: 17 },
  chapterCard: { gap: 6 },
  chapterHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  logo: { width: 48, height: 48 },
  chapterName: { fontSize: 15.5, fontWeight: '700', color: colors.g800 },
  chapterSchool: { fontSize: 12, color: colors.muted, marginTop: 1 },
  meets: { fontSize: 12.5, fontWeight: '600', color: colors.g700 },
  contact: { fontSize: 12.5, color: colors.text },
})
