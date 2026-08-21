import { Image, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Card } from '../../components/ui'
import { useLiturgicalSeason } from '../../lib/liturgical-theme'
import { styles } from '../../styles/banking.styles'

export { ErrorBoundary } from '../../components/error-boundary'

export default function BankingSnapScan() {
  const season = useLiturgicalSeason()
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <Text style={[styles.heroLabel, { color: season.text }]}>Give via SnapScan</Text>
        <Text style={[styles.heroTitle, { color: season.text }]}>ELCSA Tshwane City Parish</Text>
        <Text style={[styles.heroSub, { color: season.text }]}>Open the SnapScan app and scan the code below</Text>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Scan to Give</Text>
        <Text style={styles.cardSub}>Same code used at the offering table on Sundays — from the parish bulletin.</Text>
        <View style={styles.qrWrap}>
          <Image source={require('../../assets/brand/snapscan-qr.png')} style={styles.qrImage} resizeMode="contain" />
        </View>
        <Text style={styles.cardSub}>SnapScan giving is tracked separately on the parish's weekly offering summary — no reference code needed.</Text>
      </Card>

      <Text style={styles.backLink} onPress={() => router.push('/(app)/banking')}>
        ← Back to Banking
      </Text>
    </ScrollView>
  )
}
