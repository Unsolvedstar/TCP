import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { Button, Card, Field } from '../../components/ui'
import { useLiturgicalSeason } from '../../lib/liturgicalTheme'
import { useCongregationData } from '../../lib/congregationContext'
import { useAuth } from '../../lib/authContext'
import { supabase } from '../../lib/supabase'
import { buildSnapscanPaymentUrl, centsToRandsDisplay, randsToCents } from '../../lib/snapscanPaygate'
import { colors } from '../../theme'
import { styles } from '../../styles/banking.styles'
import type { SnapscanPayment } from '../../lib/types'

export { ErrorBoundary } from '../../components/errorBoundary'

const PAYMENT_COLUMNS = 'id,merchant_reference,amount_cents,status,created_at,completed_at'
const POLL_INTERVAL_MS = 3000
// Matches SnapScan's own documented webhook retry window — if it hasn't
// resolved by then, it's not going to via polling either; the history list
// will still pick up the final status whenever it does land.
const POLL_TIMEOUT_MS = 3 * 60 * 1000

export default function BankingSnapScan() {
  const season = useLiturgicalSeason()
  const { congregation } = useCongregationData()
  const { profile } = useAuth()

  const [amountInput, setAmountInput] = useState('')
  const [amountError, setAmountError] = useState('')
  const [starting, setStarting] = useState(false)
  const [activePayment, setActivePayment] = useState<SnapscanPayment | null>(null)
  const [history, setHistory] = useState<SnapscanPayment[]>([])

  const loadHistory = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('snapscan_payments').select(PAYMENT_COLUMNS).eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(10)
    setHistory((data as SnapscanPayment[]) ?? [])
  }, [profile])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // The definitive source of truth is always the webhook-updated DB row —
  // this just polls it while a payment is in flight so the screen updates
  // without the member having to manually refresh. Needed on every platform,
  // not just as a redirect fallback: on desktop web the payment is often
  // confirmed on a different device (phone) entirely, so there's no redirect
  // back to this tab to react to.
  useEffect(() => {
    if (!activePayment || activePayment.status !== 'pending') return
    const startedAt = Date.now()
    const interval = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        clearInterval(interval)
        return
      }
      const { data } = await supabase.from('snapscan_payments').select(PAYMENT_COLUMNS).eq('id', activePayment.id).single()
      if (data && data.status !== 'pending') {
        setActivePayment(data as SnapscanPayment)
        loadHistory()
        clearInterval(interval)
      }
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [activePayment?.id, activePayment?.status, loadHistory])

  async function onPay() {
    setAmountError('')
    const cents = randsToCents(amountInput)
    if (!cents) {
      setAmountError('Enter a valid amount, e.g. 150 or 150.50')
      return
    }
    if (!congregation?.snapscan_merchant_code) {
      setAmountError("SnapScan checkout isn't set up for this congregation yet.")
      return
    }
    setStarting(true)
    const { data, error } = await supabase.rpc('create_snapscan_payment', { p_amount_cents: cents })
    setStarting(false)
    const row = (data as { id: string; merchant_reference: string }[] | null)?.[0]
    if (error || !row) {
      setAmountError(error?.message ?? 'Could not start payment. Please try again.')
      return
    }
    // Note: (app) is a route group (app/(app)/_layout.tsx) — group folders
    // never appear in the resolved URL, only in router.push()-style
    // in-app navigation paths, so the deep link path here is bare.
    const returnUrl = Linking.createURL('/bankingSnapscan')
    const url = buildSnapscanPaymentUrl({
      merchantCode: congregation.snapscan_merchant_code,
      merchantReference: row.merchant_reference,
      amountCents: cents,
      successUrl: returnUrl,
      failureUrl: returnUrl,
    })
    setActivePayment({ id: row.id, merchant_reference: row.merchant_reference, amount_cents: cents, status: 'pending', created_at: new Date().toISOString(), completed_at: null })
    setAmountInput('')
    await Linking.openURL(url)
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: season.color }]}>
        <Text style={[styles.heroLabel, { color: season.text }]}>Give via SnapScan</Text>
        <Text style={[styles.heroTitle, { color: season.text }]}>{congregation?.name ?? ''}</Text>
        <Text style={[styles.heroSub, { color: season.text }]}>Enter an amount and confirm in the SnapScan app</Text>
      </View>

      <Card>
        <Text style={styles.cardTitle}>Pay Now</Text>
        <Text style={styles.cardSub}>Enter an amount and confirm in the SnapScan app — no scanning needed, and it's recorded on your own giving history below.</Text>
        <View style={{ gap: 10, marginTop: 4 }}>
          <Field
            label="Amount (Rand)"
            value={amountInput}
            onChangeText={setAmountInput}
            placeholder="e.g. 150"
            keyboardType="decimal-pad"
            editable={!starting}
          />
          {amountError ? <Text style={styles.snapscanError}>{amountError}</Text> : null}
          <Button title="Pay with SnapScan" onPress={onPay} loading={starting} disabled={!congregation?.snapscan_merchant_code} />
          {!congregation?.snapscan_merchant_code ? <Text style={styles.cardSub}>SnapScan checkout isn't set up for this congregation yet.</Text> : null}
        </View>

        {activePayment ? (
          <View style={[styles.snapscanStatusBox, statusBoxStyle(activePayment.status)]}>
            {activePayment.status === 'pending' ? (
              <>
                <ActivityIndicator color={colors.g700} />
                <Text style={styles.snapscanStatusPendingText}>Waiting for confirmation in SnapScan — {centsToRandsDisplay(activePayment.amount_cents)}</Text>
              </>
            ) : activePayment.status === 'completed' ? (
              <Text style={styles.snapscanStatusCompletedText}>✓ Received — {centsToRandsDisplay(activePayment.amount_cents)}. Thank you!</Text>
            ) : (
              <Text style={styles.snapscanStatusErrorText}>Payment wasn't completed. You can try again above.</Text>
            )}
          </View>
        ) : null}
      </Card>

      {history.length > 0 ? (
        <Card>
          <Text style={styles.cardTitle}>Your SnapScan Giving</Text>
          {history.map((p) => (
            <View key={p.id} style={styles.snapscanHistoryRow}>
              <Text style={styles.snapscanHistoryDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
              <Text style={styles.snapscanHistoryAmount}>{centsToRandsDisplay(p.amount_cents)}</Text>
              <Text style={[styles.snapscanHistoryStatus, historyStatusStyle(p.status)]}>{p.status}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Text style={styles.backLink} onPress={() => router.push('/(app)/banking')}>
        ← Back to Banking
      </Text>
    </ScrollView>
  )
}

function statusBoxStyle(status: SnapscanPayment['status']) {
  if (status === 'completed') return styles.snapscanStatusBoxCompleted
  if (status === 'error') return styles.snapscanStatusBoxError
  return styles.snapscanStatusBoxPending
}

function historyStatusStyle(status: SnapscanPayment['status']) {
  if (status === 'completed') return styles.snapscanHistoryStatusCompleted
  if (status === 'error') return styles.snapscanHistoryStatusError
  return styles.snapscanHistoryStatusPending
}
