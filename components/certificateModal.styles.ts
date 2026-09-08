import { Platform, StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' })

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40, alignItems: 'center' },
  // Outer + inner border pair reads as a heavier, more formal double rule
  // than a single thin border — the digital stand-in for the printed
  // certificate's decorative frame, since there's no scrollwork artwork in
  // assets/ to actually reproduce.
  paper: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    borderWidth: 5,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: 22,
    alignItems: 'center',
  },
  paperInner: {
    width: '100%',
    borderWidth: 2,
    borderColor: colors.gold3,
    borderRadius: radius.md - 6,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  crest: { width: 64, height: 64, marginBottom: 12 },
  kicker: { fontSize: 11, letterSpacing: 2, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  parishName: { fontSize: 14, fontWeight: '700', color: colors.g800, marginTop: 2, marginBottom: 14, textAlign: 'center' },
  rule: { width: 60, height: 2, backgroundColor: colors.gold, marginBottom: 14 },
  title: { fontFamily: serif, fontSize: 22, fontWeight: '700', color: colors.g900, textAlign: 'center', marginBottom: 18 },
  bodyLine: { fontFamily: serif, fontSize: 14.5, color: colors.text, textAlign: 'center', lineHeight: 22 },
  name: { fontFamily: serif, fontSize: 20, fontWeight: '700', color: colors.g800, textAlign: 'center', marginVertical: 6 },
  detail: { fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  date: { fontSize: 13, fontWeight: '700', color: colors.g700, textAlign: 'center', marginTop: 14 },
  badge: { width: 56, height: 56, marginTop: 14 },

  // Bible verse block — italic quote centered above a smaller, bold
  // "— Reference" line. Omitted entirely by the component when no verse is set.
  verseBlock: { marginTop: 16, marginBottom: 2, paddingHorizontal: 8 },
  verseText: { fontFamily: serif, fontStyle: 'italic', fontSize: 13.5, color: colors.g800, textAlign: 'center', lineHeight: 20 },
  verseRef: { fontSize: 11.5, fontWeight: '700', color: colors.gold, textAlign: 'center', marginTop: 6, letterSpacing: 0.3 },

  // Baptism details grid — label:value pairs, two per row on wide layouts,
  // wrapping to one per row on narrow ones via flexWrap + minWidth.
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginTop: 16 },
  detailRow: { width: '48%', minWidth: 150, marginBottom: 10 },
  detailLabel: { fontSize: 9.5, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  detailValue: { fontSize: 12.5, fontWeight: '600', color: colors.text, marginTop: 1 },

  // League signature blocks — a thin rule standing in for a signature line
  // (signature capture itself was removed for POPIA compliance), a typed
  // name in an italic serif, and a small caption underneath. Either block is
  // omitted entirely when its name is blank.
  signatureRow: { flexDirection: 'row', width: '100%', marginTop: 24, gap: 16 },
  signatureBlock: { flex: 1, alignItems: 'center' },
  signatureLine: { width: '100%', borderTopWidth: 1.5, borderTopColor: colors.g700, marginBottom: 6 },
  signatureName: { fontFamily: serif, fontStyle: 'italic', fontWeight: '700', fontSize: 14, color: colors.g800, textAlign: 'center' },
  signatureCaption: { fontSize: 10, color: colors.muted, textAlign: 'center', marginTop: 2 },

  seal: {
    marginTop: 22,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.g700,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  sealImage: { width: 36, height: 36 },
  // Confirmation certificates keep the original plain-glyph seal — no
  // template exists for them yet, so that branch renders exactly as before.
  sealCross: { fontSize: 22, color: colors.g700 },
  footer: { fontSize: 10.5, color: colors.muted, marginTop: 8, textAlign: 'center' },
  actions: { width: '100%', maxWidth: 480, gap: 10, marginTop: 20 },
})
