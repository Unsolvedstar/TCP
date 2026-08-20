import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.muted },
  box: { height: 160, borderWidth: 1.5, borderColor: '#d5cfc5', borderStyle: 'dashed', borderRadius: radius.md, backgroundColor: colors.white, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hint: { fontSize: 11.5, color: colors.muted, fontStyle: 'italic' },
  clearLink: { fontSize: 12, fontWeight: '700', color: colors.danger },
})
