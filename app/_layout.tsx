import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../lib/auth-context'
import { CongregationDataProvider } from '../lib/congregation-context'
import { LeagueAdminProvider } from '../lib/league-admin-context'
import { AlertHost } from '../lib/alert'

export { ErrorBoundary } from '../components/error-boundary'

export default function RootLayout() {
  return (
    <AuthProvider>
      <CongregationDataProvider>
        <LeagueAdminProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
          <AlertHost />
        </LeagueAdminProvider>
      </CongregationDataProvider>
    </AuthProvider>
  )
}
