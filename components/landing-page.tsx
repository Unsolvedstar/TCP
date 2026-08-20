import { Image, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Button, Card } from './ui'
import { getUpcomingChurchEvents } from '../lib/church-calendar'
import { useLiturgicalSeason } from '../lib/liturgical-theme'
import { formatShortDate } from '../lib/dates'
import { styles } from './landing-page.styles'

const FEATURES = [
  { title: 'Your membership, in one place', body: 'See your ward, league, baptism and confirmation status, and request changes without waiting for the office.' },
  { title: 'Register your household', body: "Add children who don't have their own phone, and manage their league, baptism and confirmation from your account." },
  { title: 'See the whole parish', body: 'Ward, league, gender and sacrament breakdowns. Real numbers, kept private, visible to everyone signed in.' },
]

export function LandingPage() {
  const season = useLiturgicalSeason()
  const nextEvent = getUpcomingChurchEvents(new Date(), 1)[0]

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <View style={styles.halo}>
          <Image source={require('../assets/brand/church-logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.seasonPill}>
          <Text style={[styles.seasonPillText, { color: season.text }]}>{season.name}</Text>
        </View>
        <Text style={[styles.heroTitle, { color: season.text }]}>ELCSA Tshwane City Parish</Text>
        <Text style={[styles.heroTagline, { color: season.text }]}>Growing Together in Christ</Text>
        {nextEvent ? (
          <Text style={[styles.heroNext, { color: season.text }]}>
            Next in the church year: {nextEvent.name} on {formatShortDate(nextEvent.date)}
          </Text>
        ) : null}
        <View style={styles.heroButtons}>
          <View style={{ flex: 1 }}>
            <Button title="Sign In" onPress={() => router.push('/login')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Create Account" variant="secondary" onPress={() => router.push('/register')} />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureBody}>{f.body}</Text>
          </Card>
        ))}

        <Text style={styles.footer}>
          959 Pretorius Street, Arcadia, Tshwane{'\n'}elcsatcp.org
        </Text>
      </View>
    </ScrollView>
  )
}
