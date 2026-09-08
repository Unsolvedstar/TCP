import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { LandingPage } from '../components/landingPage'
import { useAuth } from '../lib/authContext'
import { colors } from '../theme'

export { ErrorBoundary } from '../components/errorBoundary'

export default function Index() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.g700} size="large" />
      </View>
    )
  }

  if (!session) return <LandingPage />
  return <Redirect href={profile?.role === 'admin' ? '/(app)/dashboard' : '/(app)/portal'} />
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
})
