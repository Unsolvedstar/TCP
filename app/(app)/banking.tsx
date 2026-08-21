import { ScrollView, Text, View } from 'react-native'
import { Card } from '../../components/ui'
import { useLiturgicalSeason } from '../../lib/liturgical-theme'
import { useCongregationData } from '../../lib/congregation-context'
import { styles } from '../../styles/banking.styles'

export { ErrorBoundary } from '../../components/error-boundary'

const REFERENCE_CODES: { code: string; label: string; account: 'General' | 'Building' }[] = [
  { code: 'PLG', label: 'Pledge & Tithe', account: 'General' },
  { code: 'SOF', label: 'Sunday Offering', account: 'General' },
  { code: 'BPT', label: 'Baptism', account: 'General' },
  { code: 'DCN', label: 'Diaconate Ministry', account: 'General' },
  { code: 'CNF', label: 'Confirmation', account: 'General' },
  { code: 'RLY', label: 'Rally', account: 'General' },
  { code: 'HVT', label: 'Harvest', account: 'General' },
  { code: 'BLD', label: 'Building Project', account: 'Building' },
]

export default function Banking() {
  const season = useLiturgicalSeason()
  const { wards } = useCongregationData()
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <Text style={[styles.heroLabel, { color: season.text }]}>Banking Information</Text>
        <Text style={[styles.heroTitle, { color: season.text }]}>ELCSA Tshwane City Parish</Text>
        <Text style={[styles.heroSub, { color: season.text }]}>Standard Bank. Use the correct account and reference for each payment</Text>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Other Ways to Give</Text>
        <Text style={styles.cardSub}>SnapScan is also accepted on Sundays. Look for the scanner at the offering table. It's tracked separately on the parish's weekly offering summary.</Text>
      </Card>

      <Card>
        <View style={styles.acctHead}>
          <Text style={styles.cardTitle}>General Account</Text>
          <Text style={styles.tag}>Current</Text>
        </View>
        <Row k="Account Name" v="ELCSA Tshwane City Parish" />
        <Row k="Bank" v="Standard Bank" />
        <Row k="Account No." v="012 165 778" />
        <Row k="Branch Code" v="012 345" />
      </Card>

      <Card>
        <View style={styles.acctHead}>
          <Text style={styles.cardTitle}>Building Account</Text>
          <Text style={styles.tag}>Current</Text>
        </View>
        <Row k="Account Name" v="ELCSA Tshwane City Parish" />
        <Row k="Bank" v="Standard Bank" />
        <Row k="Account No." v="014 148 757" />
        <Row k="Branch Code" v="012 345" />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Payment Reference Codes</Text>
        {REFERENCE_CODES.map((r) => (
          <View key={r.code} style={styles.codeRow}>
            <Text style={styles.codePill}>{r.code}</Text>
            <Text style={styles.codeLabel}>{r.label}</Text>
            <Text style={[styles.codeBadge, r.account === 'Building' && styles.codeBadgeBuilding]}>{r.account === 'Building' ? 'Building Acc.' : 'General'}</Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Ward Codes</Text>
        <View style={styles.wardRow}>
          {wards.map((w) => (
            <View key={w.id} style={styles.wardCell}>
              <Text style={styles.wardName}>{w.name}</Text>
              <Text style={styles.wardCode}>{w.bank_code}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.cardTitle}>Reference Format</Text>
        <Text style={styles.cardSub}>Surname + Ward Code + Payment Code</Text>
        <View style={styles.example}>
          <Text style={styles.exampleLabel}>Pledge & Tithe, South Ward (500)</Text>
          <Text style={styles.exampleCode}>Neswiswi500PLG</Text>
        </View>
        <View style={[styles.example, styles.exampleBuilding]}>
          <Text style={styles.exampleLabel}>Building Project, South Ward (500) → Building Account</Text>
          <Text style={styles.exampleCode}>Neswiswi500BLD</Text>
        </View>
      </Card>
    </ScrollView>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={styles.rowVal}>{v}</Text>
    </View>
  )
}
