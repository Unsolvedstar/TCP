import { StyleSheet } from 'react-native'
import { colors } from '../theme'

// The certificate sheet's own styles live in certificatePaper.styles.ts.
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40, alignItems: 'center' },
  actions: { width: '100%', maxWidth: 480, gap: 10, marginTop: 20 },
})
