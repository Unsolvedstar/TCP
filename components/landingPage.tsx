import { useState } from 'react'
import { Image, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { Button, Card } from './ui'
import { getUpcomingChurchEvents } from '../lib/churchCalendar'
import { useLiturgicalSeason } from '../lib/liturgicalTheme'
import { formatShortDate } from '../lib/dates'
import { VISITOR_LINK } from '../lib/config'
import { styles } from './landingPage.styles'

const FEATURES = [
  { title: 'Your membership, in one place', body: 'See your ward, league, baptism and confirmation status, and request changes without waiting for the office.' },
  { title: 'Register your household', body: "Add children who don't have their own phone, and manage their league, baptism and confirmation from your account." },
  { title: 'See the whole parish', body: 'Ward, league, gender and sacrament breakdowns. Real numbers, kept private, visible to everyone signed in.' },
]

export function LandingPage() {
  const season = useLiturgicalSeason()
  const nextEvent = getUpcomingChurchEvents(new Date(), 1)[0]
  // Which question the hero is on — the first thing anyone lands on is
  // "just visiting or a member?", not a Sign In button; Sign In/Create
  // Account only appear once "I'm a Member" narrows it down. (Replaces the
  // old separate /welcome screen, which asked the same question but one tap
  // deeper, behind "Create Account".)
  const [showMemberOptions, setShowMemberOptions] = useState(false)

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <View style={styles.halo}>
          <Image source={require('../assets/brand/churchLogo.png')} style={styles.logo} resizeMode="contain" />
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

        <Text style={[styles.heroQuestion, { color: season.text }]}>
          {showMemberOptions ? 'Sign in, or create a new member account?' : 'Are you just visiting, or a member of the parish?'}
        </Text>

        {showMemberOptions ? (
          <>
            <View style={styles.heroButtons}>
              <View style={{ flex: 1 }}>
                <Button title="Sign In" onPress={() => router.push('/login')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Create Account" variant="secondary" onPress={() => router.push('/register')} />
              </View>
            </View>
            <Text style={[styles.heroNote, { color: season.text }]}>
              Registering will automatically group you with your family if we recognise you, or start a new family record for you.
            </Text>
            <Text style={[styles.heroBackLink, { color: season.text }]} onPress={() => setShowMemberOptions(false)}>
              ← Not a member
            </Text>
          </>
        ) : (
          <View style={styles.heroButtons}>
            <View style={{ flex: 1 }}>
              <Button title="Just Visiting" variant="secondary" onPress={() => Linking.openURL(VISITOR_LINK)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="I'm a Member" onPress={() => setShowMemberOptions(true)} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <Text style={styles.featureTitle}>{f.title}</Text>
            <Text style={styles.featureBody}>{f.body}</Text>
          </Card>
        ))}

        <Card>
          <Text style={styles.featureTitle}>Part of a different congregation?</Text>
          <Text style={styles.featureBody}>This app serves multiple ELCSA congregations — find yours to register.</Text>
          <Button title="Find Your Congregation" variant="secondary" onPress={() => router.push('/congregations')} />
        </Card>

        <Text style={styles.footer}>
          959 Pretorius Street, Arcadia, Tshwane{'\n'}elcsatcp.org
        </Text>
      </View>
    </ScrollView>
  )
}
