import { Image, Modal, ScrollView, Text, View } from 'react-native'
import { Button, Card } from './ui'
import { styles } from './elcsaso-modal.styles'
import { colors } from '../theme'

const CHAPTERS = [
  {
    key: 'up',
    name: 'ELCSASO UP',
    school: 'University of Pretoria',
    meets: 'Meets Mondays at 18H00',
    contacts: ['Br Tebogo, 072 670 8644', 'Sr Zwoanda, 072 816 2600'],
    logo: require('../assets/brand/badge-elcsaso-up.png'),
  },
  {
    key: 'eduvos',
    name: 'ELCSASO Eduvos (PTA)',
    school: 'Eduvos Pretoria',
    meets: null,
    contacts: ['Sr Barati, 071 379 3730'],
    logo: require('../assets/brand/badge-elcsaso-eduvos.png'),
  },
  {
    key: 'tut',
    name: 'ELCSASO TUT',
    school: 'Tshwane University of Technology',
    meets: 'Meets Fridays',
    contacts: ['Br Tumiso, 063 237 0626', 'Sr Kelebogile, 067 607 1726'],
    logo: require('../assets/brand/badge-elcsaso-tut.png'),
  },
]

export function ElcsasoModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        <Text style={styles.heading}>ELCSASO Chapters</Text>
        <Text style={styles.sub}>ELCSA Student Organisation — one campus chapter each, all under the same parish</Text>

        {CHAPTERS.map((c) => (
          <Card key={c.key} style={styles.chapterCard}>
            <View style={styles.chapterHead}>
              <Image source={c.logo} style={styles.logo} resizeMode="contain" />
              <View style={{ flex: 1 }}>
                <Text style={styles.chapterName}>{c.name}</Text>
                <Text style={styles.chapterSchool}>{c.school}</Text>
              </View>
            </View>
            {c.meets ? <Text style={styles.meets}>{c.meets}</Text> : null}
            {c.contacts.map((line) => (
              <Text key={line} style={styles.contact}>
                {line}
              </Text>
            ))}
          </Card>
        ))}

        <View style={{ marginTop: 10 }}>
          <Button title="Close" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  )
}
