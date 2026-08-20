import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.g800 },
  cardSub: { fontSize: 12.5, color: colors.muted, marginBottom: 14, marginTop: 2 },
  addChildForm: { gap: 12, backgroundColor: colors.g50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.g100, padding: 14, marginTop: 12 },
  signatureNote: { fontSize: 11.5, color: colors.muted, fontStyle: 'italic', marginTop: -6 },
})
