import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../lib/authContext'
import { CongregationDataProvider } from '../lib/congregationContext'
import { LeagueAdminProvider } from '../lib/leagueAdminContext'
import { AlertHost } from '../lib/alert'
import { FloatingParticles } from '../components/floatingParticles'

export { ErrorBoundary } from '../components/errorBoundary'

export default function RootLayout() {
  return (
    <AuthProvider>
      <CongregationDataProvider>
        <LeagueAdminProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
          <FloatingParticles />
          <AlertHost />
        </LeagueAdminProvider>
      </CongregationDataProvider>
    </AuthProvider>
  )
}
