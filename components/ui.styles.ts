import { StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

// Plain DOM style object (px units required) for the web-only <input type="date">
// in DateField. The input sits inside the same bordered `inputWrap` box every
// other field uses, so the border, height, width and focus ring all come from
// that shared container — the input itself is just a borderless, transparent
// fill (browsers size a bordered/padded date input differently from a text one).
export const webDateInputStyle = {
  border: 'none',
  outline: 'none',
  background: 'transparent',
  flex: 1,
  minWidth: 0,
  width: '100%',
  height: '100%',
  padding: 0,
  margin: 0,
  fontSize: '15px',
  fontFamily: 'inherit',
  color: colors.text,
  boxSizing: 'border-box' as const,
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#3a3226',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  screenTitle: { fontSize: 24, fontWeight: '800', color: colors.g800 },
  screenSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.muted, marginBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 99, borderWidth: 1, alignSelf: 'flex-start', maxWidth: '100%' },
  chipText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  barLabelCol: { width: 100 },
  barLabel: { fontSize: 12.5, fontWeight: '600', color: colors.g800 },
  barSub: { fontSize: 10.5, color: colors.muted },
  barTrack: { flex: 1, height: 9, backgroundColor: colors.cream, borderRadius: 99, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 99 },
  barValue: { width: 28, textAlign: 'right', fontSize: 13, fontWeight: '800', color: colors.g800 },
  fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.muted },
  inputWrap: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderWidth: 1.5, borderColor: '#d5cfc5', borderRadius: radius.md, backgroundColor: colors.white, paddingHorizontal: 14 },
  inputFocused: { borderColor: colors.g600, shadowColor: colors.g600, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  inputError: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
  inputPrefix: { fontSize: 17, fontWeight: '700', color: colors.muted, marginRight: 8 },
  inputText: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: 12, outlineStyle: 'none' } as object,
  input: { borderWidth: 1.5, borderColor: '#d5cfc5', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15, color: colors.text, backgroundColor: colors.white },
  btn: { borderWidth: 1.5, borderRadius: 99, minHeight: 50, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryShadow: { shadowColor: colors.g800, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  btnText: { fontSize: 14.5, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.warmBorder,
    borderBottomWidth: 0,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: colors.g800, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.warmBorder, marginBottom: 4 },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 20 },
  modalOptionActive: { backgroundColor: colors.g50 },
  modalOptionText: { fontSize: 15, color: colors.text },
  modalOptionTextActive: { color: colors.g700, fontWeight: '700' },
})
