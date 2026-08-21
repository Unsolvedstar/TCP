import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../../components/ui'
import { useAuth } from '../../lib/auth-context'
import { useLeagueAdmin } from '../../lib/league-admin-context'
import { Alert } from '../../lib/alert'
import { colors, radius } from '../../theme'

export { ErrorBoundary } from '../../components/error-boundary'

function SignOutButton() {
  const { signOut } = useAuth()
  return (
    <Pressable
      onPress={() => Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut },
      ])}
      style={{ paddingHorizontal: 16 }}
      hitSlop={10}
    >
      <Ionicons name="log-out-outline" size={22} color={colors.g700} />
    </Pressable>
  )
}

export default function AppLayout() {
  const { session, profile, loading, signOut } = useAuth()
  const { myLeagueIds } = useLeagueAdmin()

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

  const isAdmin = profile?.role === 'admin'

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { color: colors.g800, fontWeight: '700' },
        headerRight: () => <SignOutButton />,
        tabBarActiveTintColor: colors.g700,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.warmBorder },
      }}
    >
      <Tabs.Screen
        name="portal"
        options={{
          title: 'My Portal',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="banking"
        options={{
          title: 'Banking',
          tabBarIcon: ({ color, size }) => <Ionicons name="card-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="banking-snapscan" options={{ title: 'SnapScan', href: null }} />
      <Tabs.Screen
        name="league-admin"
        options={{
          title: isAdmin ? 'League Tools' : 'My League',
          href: myLeagueIds.length > 0 || isAdmin ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="megaphone-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: 28, gap: 12 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.g800, textAlign: 'center' },
  notFoundBody: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  notFoundBtn: { width: '100%', maxWidth: 260, borderRadius: radius.md },
})
