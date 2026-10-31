import { Platform, StyleSheet } from 'react-native'
import { colors } from '../theme'

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' })
// Closest thing to the calligraphic hand on the paper certificates that every
// platform ships with — no font download needed.
const script = Platform.select({
  ios: 'Snell Roundhand',
  android: 'cursive',
  default: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive',
})

export const INK = colors.brandNavy

export const styles = StyleSheet.create({
  paper: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    position: 'relative',
    overflow: 'hidden',
  },
  // Leaves clear space inside the frame for its scrollwork corners.
  body: { paddingVertical: 38, paddingHorizontal: 34, alignItems: 'center' },

  // --- shared ------------------------------------------------------------
  headerBold: { fontWeight: '800', color: INK, textAlign: 'center', fontSize: 13.5, lineHeight: 19 },
  kicker: { fontSize: 11, letterSpacing: 2, color: colors.muted, fontWeight: '700', textTransform: 'uppercase' },
  tagline: { fontSize: 14, fontWeight: '700', color: colors.g800, marginTop: 2, marginBottom: 12, textAlign: 'center' },
  rule: { width: 60, height: 2, backgroundColor: colors.gold, marginBottom: 14 },
  title: { fontFamily: serif, fontSize: 22, fontWeight: '700', color: colors.g900, textAlign: 'center', marginBottom: 16 },
  bodyLine: { fontFamily: serif, fontSize: 14.5, color: colors.text, textAlign: 'center', lineHeight: 22 },
  scriptName: { fontFamily: script, fontSize: 38, color: INK, textAlign: 'center', marginTop: 6, lineHeight: 50 },
  plainName: { fontFamily: serif, fontSize: 20, fontWeight: '700', color: colors.g800, textAlign: 'center', marginVertical: 6 },
  dottedLine: { width: '86%', borderBottomWidth: 1.5, borderStyle: 'dotted', borderBottomColor: INK, marginTop: 2, marginBottom: 12 },
  detail: { fontSize: 12.5, color: colors.muted, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  date: { fontSize: 13, fontWeight: '700', color: colors.g700, textAlign: 'center', marginTop: 14 },
  verseBlock: { marginTop: 16, marginBottom: 2, paddingHorizontal: 4, alignItems: 'center' },
  verseRule: { marginBottom: 10 },
  verseText: { fontFamily: serif, fontStyle: 'italic', fontSize: 13.5, color: INK, textAlign: 'center', lineHeight: 20 },
  verseRef: { fontSize: 12, fontWeight: '700', color: INK, textAlign: 'center', marginTop: 4, letterSpacing: 0.3 },
  // Sits behind everything; whole-sheet, faint, centred.
  watermark: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', opacity: 0.055 },
  footer: { fontSize: 10.5, color: colors.muted, marginTop: 10, textAlign: 'center' },

  // --- league installation -------------------------------------------------
  leagueTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 10 },
  leagueName: { fontSize: 19, fontWeight: '800', color: INK, textAlign: 'center', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 14 },
  installDate: { fontSize: 12.5, fontWeight: '700', color: INK, letterSpacing: 0.8, textTransform: 'uppercase', textAlign: 'center' },
  signatureRow: { flexDirection: 'row', width: '100%', marginTop: 26, alignItems: 'flex-end', justifyContent: 'space-between' },
  signatureBlock: { flex: 1, minWidth: 0, alignItems: 'center' },
  signatureLine: { width: '88%', borderTopWidth: 1.5, borderTopColor: INK, marginBottom: 5 },
  signatureName: { fontFamily: serif, fontWeight: '700', fontSize: 12.5, color: INK, textAlign: 'center' },
  signatureCaption: { fontSize: 10.5, color: colors.muted, textAlign: 'center', marginTop: 1 },
  signatureSeal: { width: 84, alignItems: 'center', marginHorizontal: 4 },

  // --- baptism -----------------------------------------------------------
  // Heavy rules top and bottom, as on the paper certificate.
  baptismRuleTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, backgroundColor: INK },
  baptismRuleBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, backgroundColor: INK },
  baptismBody: { paddingTop: 30, paddingBottom: 30, paddingHorizontal: 22, alignItems: 'center' },
  baptismHeading: { fontFamily: serif, fontSize: 14, fontWeight: '800', color: INK, lineHeight: 21, letterSpacing: 0.8, textAlign: 'center', textTransform: 'uppercase' },
  baptismTitle: { fontFamily: serif, fontSize: 15, fontWeight: '800', color: INK, letterSpacing: 1.2, textAlign: 'center', textTransform: 'uppercase', marginTop: 12, marginBottom: 12 },
  baptismVerse: { fontFamily: serif, fontSize: 12.5, fontWeight: '700', color: INK, lineHeight: 19, marginTop: 10, width: '100%' },
  certifyBlock: { alignItems: 'center', marginTop: 18 },
  certifyLead: { fontFamily: serif, fontSize: 12.5, color: INK },
  certifyName: { fontFamily: serif, fontSize: 18, fontWeight: '800', color: INK, letterSpacing: 0.6, textTransform: 'uppercase', marginVertical: 3, textAlign: 'center' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', width: '100%', marginTop: 16 },
  detailHalf: { width: '48%', minWidth: 150, marginBottom: 9 },
  detailFull: { width: '100%', marginBottom: 9 },
  detailText: { fontFamily: serif, fontSize: 12.5, color: INK, lineHeight: 18 },
  detailLabel: { fontWeight: '800' },
  baptismSignRow: { flexDirection: 'row', width: '100%', marginTop: 14, gap: 14 },
  baptismSignCell: { flex: 1, alignItems: 'center' },
  baptismSignValue: { fontFamily: serif, fontSize: 12.5, fontWeight: '700', color: INK, textAlign: 'center', minHeight: 18 },
  baptismSignCaption: { fontFamily: serif, fontSize: 12, color: INK, textAlign: 'center', marginTop: 2, borderTopWidth: 1, borderTopColor: INK, paddingTop: 3, width: '100%' },
  baptismFooterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 22 },
  baptismFooterCaption: { fontFamily: serif, fontSize: 9.5, fontWeight: '700', color: INK, textAlign: 'center', marginTop: 8, letterSpacing: 0.4, textTransform: 'uppercase' },
})
