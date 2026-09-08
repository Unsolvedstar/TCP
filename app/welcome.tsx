import { Pressable, ScrollView, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import * as Linking from 'expo-linking'
import { Button, GlassSheen, glassBlur } from '../components/ui'
import { ChurchHeader } from '../components/churchHeader'
import { VISITOR_LINK } from '../lib/config'
import { radius } from '../theme'
import { styles } from '../styles/welcome.styles'

export { ErrorBoundary } from '../components/errorBoundary'

export default function Welcome() {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <ChurchHeader title="Welcome" subtitle="Are you just visiting, or joining as a member?" />

      <View style={[styles.card, glassBlur]}>
        <GlassSheen cornerRadius={radius.xl} />
        <Text style={styles.cardTitle}>Just Visiting</Text>
        <Text style={styles.cardBody}>We'd still love to hear from you — this takes you to a short visitor form.</Text>
        <Button title="I'm Just Visiting" variant="secondary" onPress={() => Linking.openURL(VISITOR_LINK)} />
      </View>

      <View style={[styles.card, glassBlur]}>
        <GlassSheen cornerRadius={radius.xl} />
        <Text style={styles.cardTitle}>Become a Member</Text>
        <Text style={styles.cardBody}>
          Register and we'll automatically group you with your family if we recognise you, or start a new family record for you.
        </Text>
        <Button title="I Want to Become a Member" onPress={() => router.push('/register')} />
      </View>

      <Link href="/login" asChild>
        <Pressable>
          <Text style={styles.backLink}>← Back to Sign In</Text>
        </Pressable>
      </Link>
    </ScrollView>
  )
}
