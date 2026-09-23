import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Card, CopyButton } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { useLiturgicalSeason } from '../../lib/liturgicalTheme'
import { useCongregationData } from '../../lib/congregationContext'
import { styles } from '../../styles/banking.styles'

type MyFamily = { id: string; name: string; code: string }

export { ErrorBoundary } from '../../components/errorBoundary'

export default function Banking() {
  const season = useLiturgicalSeason()
  const { congregation, wards, bankAccounts, paymentCodes } = useCongregationData()
  const [family, setFamily] = useState<MyFamily | null>(null)

  useEffect(() => {
    supabase
      .rpc('my_family')
      .then(({ data }) => setFamily(((data as MyFamily[]) ?? [])[0] ?? null))
  }, [])

  const exampleWard = wards[0]
  const exampleCode = paymentCodes[0]
  const exampleAccountName = exampleCode ? bankAccounts.find((a) => a.id === exampleCode.account_id)?.name : undefined
  // A second worked example, only shown if there's a code pointing at a
  // different account than the first — demonstrates that the account
  // changes, not just the code, without assuming exactly two accounts exist.
  const altCode = exampleCode ? paymentCodes.find((p) => p.account_id !== exampleCode.account_id) : undefined
  const altAccountName = altCode ? bankAccounts.find((a) => a.id === altCode.account_id)?.name : undefined

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <Text style={[styles.heroLabel, { color: season.text }]}>Banking Information</Text>
        <Text style={[styles.heroTitle, { color: season.text }]}>{congregation?.name ?? ''}</Text>
        <Text style={[styles.heroSub, { color: season.text }]}>Use the correct account and reference for each payment</Text>
      </View>

      {congregation?.snapscan_merchant_code ? (
        <Card>
          <Text style={styles.cardTitle}>Other Ways to Give</Text>
          <Text style={styles.cardSub}>Pay an amount directly in the app via SnapScan.</Text>
          <Pressable style={styles.snapScanLink} onPress={() => router.push('/(app)/bankingSnapscan')}>
            <Text style={styles.snapScanLinkLabel}>Give via SnapScan</Text>
            <Text style={styles.snapScanLinkArrow}>→</Text>
          </Pressable>
        </Card>
      ) : null}

      {bankAccounts.map((account) => (
        <Card key={account.id}>
          <View style={styles.acctHead}>
            <Text style={styles.cardTitle}>{account.name} Account</Text>
            <Text style={styles.tag}>Current</Text>
          </View>
          <Row k="Account Name" v={congregation?.name ?? ''} />
          <Row k="Bank" v={account.bank_name} />
          <Row k="Account No." v={account.account_number} copyable />
          <Row k="Branch Code" v={account.branch_code} />
        </Card>
      ))}

      {paymentCodes.length > 0 ? (
        <Card>
          <Text style={styles.cardTitle}>Payment Reference Codes</Text>
          {paymentCodes.map((code) => {
            const accountIndex = bankAccounts.findIndex((a) => a.id === code.account_id)
            const accountName = bankAccounts[accountIndex]?.name
            return (
              <View key={code.id} style={styles.codeRow}>
                <Text style={styles.codePill}>{code.code}</Text>
                <Text style={styles.codeLabel}>{code.label}</Text>
                {accountName ? <Text style={[styles.codeBadge, accountIndex > 0 && styles.codeBadgeBuilding]}>{accountName}</Text> : null}
              </View>
            )
          })}
        </Card>
      ) : null}

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

      {exampleWard && exampleCode ? (
        <Card>
          <Text style={styles.cardTitle}>Reference Format</Text>
          <Text style={styles.cardSub}>Surname + Ward Code + Payment Code</Text>
          <View style={styles.example}>
            <Text style={styles.exampleLabel}>
              {exampleCode.label}, {exampleWard.name} Ward ({exampleWard.bank_code})
            </Text>
            <Text style={styles.exampleCode}>{`Surname${exampleWard.bank_code}${exampleCode.code}`}</Text>
          </View>
          {altCode ? (
            <View style={[styles.example, styles.exampleBuilding]}>
              <Text style={styles.exampleLabel}>
                {altCode.label}, {exampleWard.name} Ward ({exampleWard.bank_code}) → {altAccountName} Account
              </Text>
              <Text style={styles.exampleCode}>{`Surname${exampleWard.bank_code}${altCode.code}`}</Text>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.cardTitle}>Family Reference Format</Text>
        <Text style={styles.cardSub}>
          Paying on behalf of the whole household instead of just yourself? Use your Family Code + Payment Code instead of a surname — it's on your
          Portal's Family card, and stays the same no matter whose name is on the payment.
        </Text>
        {exampleCode ? (
          <View style={styles.example}>
            <Text style={styles.exampleLabel}>{exampleCode.label}, for the whole family{family ? ` (${family.name})` : ''}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.exampleCode}>{family ? `${family.code}${exampleCode.code}` : `AB12CD${exampleCode.code}`}</Text>
              {family ? <CopyButton value={`${family.code}${exampleCode.code}`} /> : null}
            </View>
          </View>
        ) : null}
      </Card>
    </ScrollView>
  )
}

function Row({ k, v, copyable = false }: { k: string; v: string; copyable?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowKey}>{k}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.rowVal}>{v}</Text>
        {copyable ? <CopyButton value={v} size={14} /> : null}
      </View>
    </View>
  )
}
