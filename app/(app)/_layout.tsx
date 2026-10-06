import { Redirect, Stack } from 'expo-router'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Button } from '../../components/ui'
import { BirthdayCelebration } from '../../components/birthdayCelebration'
import { SignOutButton } from '../../components/signOutButton'
import { useAuth } from '../../lib/authContext'
import { colors, radius } from '../../theme'

export { ErrorBoundary } from '../../components/errorBoundary'

// Auth gate + a Stack around the tab bar. The tabs live in (tabs)/_layout.tsx;
// SnapScan and Congregation Settings are pushed on top of them as real screens
// (back button, own history entry) rather than hidden tabs.
export default function AppLayout() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.g700} size="large" />
      </View>
    )
  }
  if (!session) return <Redirect href="/login" />

  // The signed-in auth account has no matching profile row — most likely an admin
  // removed this member from the registry. Their password still works (deleting
  // the app-level profile can't delete the underlying auth account), so without
  // this check they'd otherwise be stuck looking at a permanent loading spinner.
  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundTitle}>Account Not Found</Text>
        <Text style={styles.notFoundBody}>
          Your login still works, but there's no membership record for it anymore. An admin may have removed it from the registry. If this seems
          wrong, contact the parish office.
        </Text>
        <View style={styles.notFoundBtn}>
          <Button title="Sign Out" onPress={signOut} />
        </View>
      </View>
    )
  }

  return (
    <>
      <BirthdayCelebration />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.cream },
          headerShadowVisible: false,
          headerTintColor: colors.g700,
          headerTitleStyle: { color: colors.g800, fontWeight: '800', fontSize: 18 },
          headerRight: () => <SignOutButton />,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="bankingSnapscan" options={{ title: 'SnapScan' }} />
        <Stack.Screen name="congregationAdmin" options={{ title: 'Congregation Settings' }} />
      </Stack>
    </>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: 28, gap: 12 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.g800, textAlign: 'center' },
  notFoundBody: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  notFoundBtn: { width: '100%', maxWidth: 260, borderRadius: radius.md },
})
