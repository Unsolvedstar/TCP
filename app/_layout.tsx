import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../lib/auth-context'
import { CongregationDataProvider } from '../lib/congregation-context'

export { ErrorBoundary } from '../components/error-boundary'

export default function RootLayout() {
  return (
    <AuthProvider>
      <CongregationDataProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </CongregationDataProvider>
    </AuthProvider>
  )
}
