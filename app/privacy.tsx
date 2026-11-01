import { ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Button, Card } from '../components/ui'
import { ChurchHeader } from '../components/churchHeader'
import { contentMedium } from '../lib/layout'
import { styles } from '../styles/privacy.styles'

export { ErrorBoundary } from '../components/errorBoundary'

const UPDATED = '1 November 2026'

// Written from what this app actually collects and does (see supabase/migrations
// and the screens). If the app's data handling changes, change this page with it.
// A parish should have its Information Officer details confirmed before relying on it.
const SECTIONS: { title: string; paragraphs?: string[]; bullets?: string[] }[] = [
  {
    title: 'Who is responsible for your information',
    paragraphs: [
      'This app is used by ELCSA congregations. The congregation you register with is the responsible party for your information under the Protection of Personal Information Act (POPIA). For ELCSA Tshwane City Parish that is the parish office at 959 Pretorius Street, Arcadia, Tshwane.',
    ],
  },
  {
    title: 'What we collect',
    bullets: [
      'Your account: name, email address and password (the password is stored scrambled by our sign-in provider; nobody can read it) and, optionally, your phone number.',
      'Your membership: ward, league or organisation, family or household, birthday, gender, and your profession if you choose to share it.',
      'Sacraments: whether you are baptised or confirmed, the details you or an admin enter (sponsor or mentor, officiant, place, date, parents, register number), and photos of certificates you upload.',
      'Children: a parent or guardian can register children who have no phone. We then hold the child’s name, birthday, gender, ward, league and sacrament details under the guardian’s account.',
      'Giving: if you pay through SnapScan we record the amount, the reference and whether the payment went through. Your card or bank details are handled by SnapScan and are never stored by this app.',
      'Activity: when you last signed in, so admins can ask members who have gone quiet to confirm they are still part of the congregation.',
    ],
  },
  {
    title: 'Why we use it',
    paragraphs: [
      'Only to run the congregation: keeping membership records, grouping families, handling requests for baptism, confirmation and leagues, producing certificates, posting announcements, showing birthday greetings, and recording giving. We do not sell your information, advertise to you, or use it for anything unrelated.',
    ],
  },
  {
    title: 'Who can see it',
    bullets: [
      'You can see your own details and your household’s.',
      'Congregation admins, and the admins of a league for that league’s members, can see the records they need to do their work.',
      'Other signed-in members of your congregation can see overall totals, a list of upcoming birthdays (name and birthday), and the member directory. You only appear in the directory if you have chosen to share a profession; the entry shows your name, profession, ward and phone number.',
      'Nobody outside your congregation can see your records.',
    ],
  },
  {
    title: 'Where it is kept and who else handles it',
    bullets: [
      'Supabase provides our database and sign-in. Its servers are in Ireland, so your information is transferred outside South Africa to a country with strong data-protection law.',
      'Our website hosting company delivers the app to your browser.',
      'SnapScan processes payments if you give through the app.',
      'If you choose “Just Visiting” you are sent to a Google Form, which is covered by Google’s own privacy policy.',
      'When an admin looks up a Bible verse, only the verse reference they typed is sent to a public Bible lookup service.',
    ],
  },
  {
    title: 'Your device',
    paragraphs: [
      'The app keeps your sign-in on your device so you stay signed in, and stores a copy of its own pages so it opens quickly and works offline. There are no advertising or tracking cookies and no analytics.',
    ],
  },
  {
    title: 'Security',
    paragraphs: [
      'The app uses an encrypted (HTTPS) connection, and the database itself enforces who may read or change what, so members cannot read each other’s records and admin actions are checked on the server. No system is perfectly secure; if you think your account has been misused, tell the parish office straight away.',
    ],
  },
  {
    title: 'How long we keep it',
    paragraphs: [
      'For as long as you are a member. When you leave, or ask us to remove you, your records are deleted by an admin.',
    ],
  },
  {
    title: 'Your rights',
    paragraphs: [
      'You may ask to see the information we hold about you, to correct it, or to have it deleted, and you may object to how it is used. You can correct most of your own details in the app under My Details; for anything else, ask the parish office. If you are unhappy with how your information is handled you may complain to the Information Regulator of South Africa (inforegulator.org.za).',
    ],
  },
  {
    title: 'Children',
    paragraphs: [
      'A parent or guardian who registers a child confirms that they are entitled to do so and agrees to this policy on the child’s behalf. To see, correct or remove a child’s record, use the household section of the app or ask the parish office.',
    ],
  },
  {
    title: 'Changes',
    paragraphs: ['If we change how we handle your information we will update this page and its date.'],
  },
]

export default function Privacy() {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={[styles.content, contentMedium]}>
      <ChurchHeader title="Privacy Policy" subtitle="How we look after your information" showSeason={false} />
      <Text style={styles.updated}>Last updated {UPDATED}</Text>

      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <Text style={styles.heading}>{s.title}</Text>
          {s.paragraphs?.map((p) => (
            <Text key={p} style={styles.body}>
              {p}
            </Text>
          ))}
          {s.bullets?.map((b) => (
            <View key={b} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={[styles.body, styles.bulletText]}>{b}</Text>
            </View>
          ))}
        </Card>
      ))}

      <View style={styles.back}>
        <Button title="Back" variant="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </ScrollView>
  )
}
