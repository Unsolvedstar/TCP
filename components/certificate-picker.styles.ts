import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.muted },
  buttonRow: { flexDirection: 'row', gap: 10 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: 70, height: 70, borderRadius: radius.md, borderWidth: 1, borderColor: colors.warmBorder, backgroundColor: colors.white },
  removeLink: { fontSize: 12, fontWeight: '700', color: colors.danger },
})
