import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../../components/ui'
import { useAuth } from '../../lib/authContext'
import { useLeagueAdmin } from '../../lib/leagueAdminContext'
import { Alert } from '../../lib/alert'
import { colors, radius } from '../../theme'

export { ErrorBoundary } from '../../components/errorBoundary'

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
        headerStyle: { backgroundColor: colors.cream, shadowOpacity: 0, elevation: 0, borderBottomWidth: 0 },
        headerTitleStyle: { color: colors.g800, fontWeight: '800', fontSize: 18 },
        headerRight: () => <SignOutButton />,
        tabBarActiveTintColor: colors.g700,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 0,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          height: 66,
          paddingTop: 6,
          paddingBottom: 8,
          shadowColor: '#3a3226',
          shadowOpacity: 0.12,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
      }}
    >
      <Tabs.Screen
        name="portal"
        options={{
          title: 'My Portal',
          href: isAdmin ? null : undefined,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "grid" : "grid-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'Announcements',
          href: isAdmin || myLeagueIds.length > 0 ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "megaphone" : "megaphone-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: 'Directory',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "briefcase" : "briefcase-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="banking"
        options={{
          title: 'Banking',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "card" : "card-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="bankingSnapscan" options={{ title: 'SnapScan', href: null }} />
      <Tabs.Screen
        name="leagueAdmin"
        options={{
          title: isAdmin ? 'Leagues' : 'My League',
          href: myLeagueIds.length > 0 || isAdmin ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? "ribbon" : "ribbon-outline"} size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="congregationAdmin" options={{ title: 'Congregation Settings', href: null }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, padding: 28, gap: 12 },
  notFoundTitle: { fontSize: 17, fontWeight: '700', color: colors.g800, textAlign: 'center' },
  notFoundBody: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  notFoundBtn: { width: '100%', maxWidth: 260, borderRadius: radius.md },
})
