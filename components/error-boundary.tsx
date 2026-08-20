import { Text, View } from 'react-native'
import type { ErrorBoundaryProps } from 'expo-router'
import { Button } from './ui'
import { styles } from './error-boundary.styles'

/**
 * Exported as `ErrorBoundary` from every route file. Expo Router wraps that
 * route (and its children) in a React error boundary when it finds this
 * export, so a crash on one screen shows this instead of taking down the
 * whole app — other tabs/routes keep working.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.flex}>
      <Text style={styles.cross}>✝</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error.message}</Text>
      <View style={styles.btn}>
        <Button title="Try Again" onPress={retry} />
      </View>
    </View>
  )
}
