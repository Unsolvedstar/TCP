import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

export const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#3a3226',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  name: { fontSize: 15.5, fontWeight: '700', color: colors.g800, flex: 1 },
  nameUnclaimed: { fontSize: 15.5, fontWeight: '700', color: colors.muted, fontStyle: 'italic', flex: 1 },
  editingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  nameInput: { flex: 1, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.warmBorder, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.white },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerLink: { fontSize: 12, fontWeight: '700', color: colors.g700 },
  headerLinkDanger: { fontSize: 12, fontWeight: '700', color: colors.danger },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.cream, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 4 },
  codeText: { fontSize: 12, color: colors.muted },
  codeValue: { fontWeight: '700', color: colors.g800, letterSpacing: 1 },
  personRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.cream, paddingVertical: 8, gap: 8 },
  personName: { fontSize: 13.5, color: colors.text, flex: 1 },
  removeLink: { fontSize: 11.5, fontWeight: '700', color: colors.danger },
  emptyText: { fontSize: 12, color: colors.muted, fontStyle: 'italic', paddingVertical: 6 },
})
