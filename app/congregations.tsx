import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import { ChurchHeader } from '../components/churchHeader'
import { listRegistrationCongregations } from '../lib/congregation'
import type { CongregationSummary } from '../lib/types'
import { colors } from '../theme'
import { styles } from '../styles/congregations.styles'

export { ErrorBoundary } from '../components/errorBoundary'

// Pre-auth directory of every ELCSA congregation using this app — lets a
// visitor find their own congregation and jump straight into its
// registration flow, instead of only being reachable if they already know
// its slug/deep link.
export default function Congregations() {
  const [congregations, setCongregations] = useState<CongregationSummary[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listRegistrationCongregations()
      .then(setCongregations)
      .catch((err) => setError(err.message ?? 'Could not load the list of congregations.'))
  }, [])

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <ChurchHeader title="Find Your Congregation" subtitle="Select yours to continue to registration" />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!error && !congregations ? <ActivityIndicator color={colors.g700} /> : null}

      {congregations && congregations.length === 0 ? <Text style={styles.empty}>No congregations are set up yet.</Text> : null}

      {congregations?.map((c) => (
        <Pressable key={c.id} style={styles.row} onPress={() => router.push({ pathname: '/register', params: { slug: c.slug } })}>
          <View style={styles.logoWrap}>
            {c.logo_url ? (
              <Image source={{ uri: c.logo_url }} style={styles.logo} resizeMode="contain" />
            ) : (
              <View style={[styles.dot, { backgroundColor: c.primary_color }]} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{c.name}</Text>
            {c.tagline || c.address ? <Text style={styles.tagline}>{c.tagline ?? c.address}</Text> : null}
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
      ))}

      <Link href="/welcome" asChild>
        <Pressable>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
      </Link>
    </ScrollView>
  )
}
