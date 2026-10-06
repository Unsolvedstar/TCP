import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { SignOutButton } from '../../../components/signOutButton'
import { useAuth } from '../../../lib/authContext'
import { useLeagueAdmin } from '../../../lib/leagueAdminContext'
import { colors, radius } from '../../../theme'

export { ErrorBoundary } from '../../../components/errorBoundary'

// The auth/profile gates live one level up in app/(app)/_layout.tsx, which wraps
// these tabs in a Stack so SnapScan and Congregation Settings can be real pushed
// screens (with a back button) instead of hidden tabs.
export default function TabsLayout() {
  const { profile } = useAuth()
  const { myLeagueIds } = useLeagueAdmin()
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
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'grid' : 'grid-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: 'Members',
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'Announcements',
          href: isAdmin || myLeagueIds.length > 0 ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'megaphone' : 'megaphone-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="directory"
        options={{
          title: 'Directory',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="banking"
        options={{
          title: 'Banking',
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'card' : 'card-outline'} size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leagueAdmin"
        options={{
          title: isAdmin ? 'Leagues' : 'My League',
          href: myLeagueIds.length > 0 || isAdmin ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'ribbon' : 'ribbon-outline'} size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
