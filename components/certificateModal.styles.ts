import { Platform, StyleSheet } from 'react-native'
import { colors, radius } from '../theme'

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' })

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40, alignItems: 'center' },
  paper: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: 24,
    alignItems: 'center',
  },
  paperInner: {
    width: '100%',
    borderWidth: 1,
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
  seal: {
    marginTop: 22,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.g700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealCross: { fontSize: 22, color: colors.g700 },
  footer: { fontSize: 10.5, color: colors.muted, marginTop: 8, textAlign: 'center' },
  actions: { width: '100%', maxWidth: 480, gap: 10, marginTop: 20 },
})
