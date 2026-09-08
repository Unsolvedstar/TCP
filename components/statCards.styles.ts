import { StyleSheet } from 'react-native'
import { colors } from '../theme'

export const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.g800 },
  cardSub: { fontSize: 12.5, color: colors.muted, marginBottom: 12, marginTop: 2 },
  bdayRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.cream },
  bdayName: { fontSize: 13.5, color: colors.text, fontWeight: '600' },
  bdayWard: { fontSize: 11.5, color: colors.muted, fontWeight: '400' },
  bdayDate: { fontSize: 12.5, color: colors.muted },
})
