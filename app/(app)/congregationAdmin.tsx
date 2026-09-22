import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Alert } from '../../lib/alert'
import { Button, Card, Chip, Field, SelectField } from '../../components/ui'
import { ChipRow } from '../../components/chipRow'
import { CertificatePicker } from '../../components/certificatePicker'
import { supabase } from '../../lib/supabase'
import { useCongregationData } from '../../lib/congregationContext'
import { colors } from '../../theme'
import { styles } from '../../styles/members.styles'
import type { BankAccountRow, LeagueRow, PaymentCodeRow, WardRow } from '../../lib/types'

export { ErrorBoundary } from '../../components/errorBoundary'

// Congregation-admin-only screen (reached from a button on Members, hidden
// from the tab bar — same pattern as bankingSnapscan) to manage everything
// that used to only ever exist because a migration seeded it once: the
// congregation's own name/logo/colors, its wards and leagues, and its
// banking details. Every write goes through an admin_* RPC that re-checks
// is_admin_of() server-side (supabase/migrations/0024_congregation_admin_rpcs.sql)
// — this screen has no client-side gate of its own beyond being unreachable
// unless already on the (admin-only) Members screen.

function ColorField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Field label={label} value={value} onChangeText={onChangeText} placeholder="#1c4906" autoCapitalize="none" />
      </View>
      <Chip label=" " color={/^#[0-9a-fA-F]{3,8}$/.test(value) ? value : '#888888'} selected />
    </View>
  )
}

export default function CongregationAdmin() {
  const { congregation, wards, leagues, bankAccounts, paymentCodes, refresh } = useCongregationData()

  // Branding -------------------------------------------------------------
  const [name, setName] = useState('')
  const [tagline, setTagline] = useState('')
  const [address, setAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [primaryColor, setPrimaryColor] = useState('#1c4906')
  const [accentColor, setAccentColor] = useState('')
  const [savingBranding, setSavingBranding] = useState(false)

  useEffect(() => {
    if (!congregation) return
    setName(congregation.name)
    setTagline(congregation.tagline ?? '')
    setAddress(congregation.address ?? '')
    setLogoUrl(congregation.logo_url)
    setPrimaryColor(congregation.primary_color)
    setAccentColor(congregation.accent_color ?? '')
  }, [congregation])

  async function saveBranding() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a congregation name.')
      return
    }
    setSavingBranding(true)
    const { error } = await supabase.rpc('admin_update_congregation_branding', {
      p_name: name.trim(),
      p_tagline: tagline.trim() || null,
      p_address: address.trim() || null,
      p_logo_url: logoUrl,
      p_primary_color: primaryColor.trim() || '#1c4906',
      p_accent_color: accentColor.trim() || null,
    })
    setSavingBranding(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    await refresh()
  }

  // SnapScan paygate (in-app checkout) -------------------------------------
  const [snapscanMerchantCode, setSnapscanMerchantCode] = useState('')
  const [savingSnapscanCode, setSavingSnapscanCode] = useState(false)

  useEffect(() => {
    setSnapscanMerchantCode(congregation?.snapscan_merchant_code ?? '')
  }, [congregation])

  async function saveSnapscanMerchantCode() {
    setSavingSnapscanCode(true)
    const { error } = await supabase.rpc('admin_set_snapscan_merchant_code', { p_code: snapscanMerchantCode.trim() || null })
    setSavingSnapscanCode(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    await refresh()
  }

  // Wards ------------------------------------------------------------------
  const [editingWardId, setEditingWardId] = useState<string | null>(null)
  const [wardName, setWardName] = useState('')
  const [wardBankCode, setWardBankCode] = useState('')
  const [wardColor, setWardColor] = useState('#888888')
  const [savingWard, setSavingWard] = useState(false)

  function resetWardForm() {
    setEditingWardId(null)
    setWardName('')
    setWardBankCode('')
    setWardColor('#888888')
  }

  function startEditWard(w: WardRow) {
    setEditingWardId(w.id)
    setWardName(w.name)
    setWardBankCode(String(w.bank_code))
    setWardColor(w.color)
  }

  async function saveWard() {
    const bankCode = parseInt(wardBankCode, 10)
    if (!wardName.trim() || Number.isNaN(bankCode)) {
      Alert.alert('Missing details', 'Please enter a name and a numeric bank code.')
      return
    }
    setSavingWard(true)
    const { error } = editingWardId
      ? await supabase.rpc('admin_update_ward', { target_id: editingWardId, p_name: wardName.trim(), p_bank_code: bankCode, p_color: wardColor.trim() || '#888888' })
      : await supabase.rpc('admin_create_ward', { p_name: wardName.trim(), p_bank_code: bankCode, p_color: wardColor.trim() || '#888888' })
    setSavingWard(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    resetWardForm()
    await refresh()
  }

  function removeWard(w: WardRow) {
    Alert.alert('Remove Ward', `Remove "${w.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_delete_ward', { target_id: w.id })
          if (error) Alert.alert('Could not remove', error.message)
          else await refresh()
        },
      },
    ])
  }

  // Leagues ------------------------------------------------------------------
  const [editingLeagueId, setEditingLeagueId] = useState<string | null>(null)
  const [leagueKey, setLeagueKey] = useState('')
  const [leagueLabel, setLeagueLabel] = useState('')
  const [leagueInfo, setLeagueInfo] = useState('')
  const [leagueColor, setLeagueColor] = useState('#888888')
  const [leagueHasBadge, setLeagueHasBadge] = useState('no')
  const [savingLeague, setSavingLeague] = useState(false)

  function resetLeagueForm() {
    setEditingLeagueId(null)
    setLeagueKey('')
    setLeagueLabel('')
    setLeagueInfo('')
    setLeagueColor('#888888')
    setLeagueHasBadge('no')
  }

  function startEditLeague(l: LeagueRow) {
    setEditingLeagueId(l.id)
    setLeagueKey(l.key)
    setLeagueLabel(l.label)
    setLeagueInfo(l.info ?? '')
    setLeagueColor(l.color)
    setLeagueHasBadge(l.has_badge ? 'yes' : 'no')
  }

  async function saveLeague() {
    if (!leagueLabel.trim() || (!editingLeagueId && !leagueKey.trim())) {
      Alert.alert('Missing details', 'Please enter a key and a label.')
      return
    }
    setSavingLeague(true)
    const { error } = editingLeagueId
      ? await supabase.rpc('admin_update_league', {
          target_id: editingLeagueId,
          p_label: leagueLabel.trim(),
          p_info: leagueInfo.trim() || null,
          p_color: leagueColor.trim() || '#888888',
          p_has_badge: leagueHasBadge === 'yes',
        })
      : await supabase.rpc('admin_create_league', {
          p_key: leagueKey.trim(),
          p_label: leagueLabel.trim(),
          p_info: leagueInfo.trim() || null,
          p_color: leagueColor.trim() || '#888888',
          p_has_badge: leagueHasBadge === 'yes',
        })
    setSavingLeague(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    resetLeagueForm()
    await refresh()
  }

  function removeLeague(l: LeagueRow) {
    Alert.alert('Remove League', `Remove "${l.label}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_delete_league', { target_id: l.id })
          if (error) Alert.alert('Could not remove', error.message)
          else await refresh()
        },
      },
    ])
  }

  // Bank accounts --------------------------------------------------------
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [accountName, setAccountName] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [branchCode, setBranchCode] = useState('')
  const [savingAccount, setSavingAccount] = useState(false)

  function resetAccountForm() {
    setEditingAccountId(null)
    setAccountName('')
    setBankName('')
    setAccountNumber('')
    setBranchCode('')
  }

  function startEditAccount(a: BankAccountRow) {
    setEditingAccountId(a.id)
    setAccountName(a.name)
    setBankName(a.bank_name)
    setAccountNumber(a.account_number)
    setBranchCode(a.branch_code)
  }

  async function saveAccount() {
    if (!accountName.trim() || !bankName.trim() || !accountNumber.trim() || !branchCode.trim()) {
      Alert.alert('Missing details', 'Please fill in every field.')
      return
    }
    setSavingAccount(true)
    const { error } = editingAccountId
      ? await supabase.rpc('admin_update_bank_account', {
          target_id: editingAccountId,
          p_name: accountName.trim(),
          p_bank_name: bankName.trim(),
          p_account_number: accountNumber.trim(),
          p_branch_code: branchCode.trim(),
        })
      : await supabase.rpc('admin_create_bank_account', {
          p_name: accountName.trim(),
          p_bank_name: bankName.trim(),
          p_account_number: accountNumber.trim(),
          p_branch_code: branchCode.trim(),
        })
    setSavingAccount(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    resetAccountForm()
    await refresh()
  }

  function removeAccount(a: BankAccountRow) {
    Alert.alert('Remove Account', `Remove "${a.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_delete_bank_account', { target_id: a.id })
          if (error) Alert.alert('Could not remove', error.message)
          else await refresh()
        },
      },
    ])
  }

  // Payment codes ------------------------------------------------------------
  const [editingCodeId, setEditingCodeId] = useState<string | null>(null)
  const [codeValue, setCodeValue] = useState('')
  const [codeLabel, setCodeLabel] = useState('')
  const [codeAccountId, setCodeAccountId] = useState('')
  const [savingCode, setSavingCode] = useState(false)

  function resetCodeForm() {
    setEditingCodeId(null)
    setCodeValue('')
    setCodeLabel('')
    setCodeAccountId('')
  }

  function startEditCode(c: PaymentCodeRow) {
    setEditingCodeId(c.id)
    setCodeValue(c.code)
    setCodeLabel(c.label)
    setCodeAccountId(c.account_id)
  }

  async function saveCode() {
    if (!codeValue.trim() || !codeLabel.trim() || !codeAccountId) {
      Alert.alert('Missing details', 'Please enter a code, a label, and choose an account.')
      return
    }
    setSavingCode(true)
    const { error } = editingCodeId
      ? await supabase.rpc('admin_update_payment_code', { target_id: editingCodeId, p_code: codeValue.trim(), p_label: codeLabel.trim(), p_account_id: codeAccountId })
      : await supabase.rpc('admin_create_payment_code', { p_code: codeValue.trim(), p_label: codeLabel.trim(), p_account_id: codeAccountId })
    setSavingCode(false)
    if (error) {
      Alert.alert('Could not save', error.message)
      return
    }
    resetCodeForm()
    await refresh()
  }

  function removeCode(c: PaymentCodeRow) {
    Alert.alert('Remove Code', `Remove "${c.code}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('admin_delete_payment_code', { target_id: c.id })
          if (error) Alert.alert('Could not remove', error.message)
          else await refresh()
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Congregation Settings</Text>
      <Text style={styles.screenSub}>Manage your congregation's own name, branding, wards, leagues, and banking details.</Text>

      <Card>
        <Text style={styles.cardTitle}>Branding</Text>
        <View style={{ gap: 10 }}>
          <Field label="Congregation Name" value={name} onChangeText={setName} placeholder="e.g. ELCSA Tshwane City Parish" />
          <Field label="Tagline (optional)" value={tagline} onChangeText={setTagline} placeholder="e.g. Growing Together in Christ" />
          <Field label="Address (optional)" value={address} onChangeText={setAddress} placeholder="Street, suburb, city" />
          <ColorField label="Primary Color (hex)" value={primaryColor} onChangeText={setPrimaryColor} />
          <ColorField label="Accent Color (optional, hex)" value={accentColor} onChangeText={setAccentColor} />
          <CertificatePicker label="Logo (optional)" value={logoUrl} onChange={setLogoUrl} />
          <Button title="Save Branding" onPress={saveBranding} loading={savingBranding} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>SnapScan Checkout (Paygate)</Text>
        <Text style={styles.pendingDetail}>
          Lets members pay a specific amount in-app — SnapScan opens directly to confirm, and the payment is tracked automatically. Needs a SnapScan merchant account;
          get your merchant code from SnapScan support (help@snapscan.co.za). Leave empty to hide the "Give via SnapScan" checkout entirely.
        </Text>
        <View style={{ gap: 10, marginTop: 8 }}>
          <Field label="SnapScan Merchant Code" value={snapscanMerchantCode} onChangeText={setSnapscanMerchantCode} placeholder="e.g. yourchurch" autoCapitalize="none" />
          <Button title="Save Merchant Code" onPress={saveSnapscanMerchantCode} loading={savingSnapscanCode} />
        </View>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{editingWardId ? 'Edit Ward' : 'Add a Ward'}</Text>
        <View style={{ gap: 10 }}>
          <Field label="Name" value={wardName} onChangeText={setWardName} placeholder="e.g. North" />
          <Field label="Bank Code" value={wardBankCode} onChangeText={setWardBankCode} placeholder="e.g. 100" keyboardType="number-pad" />
          <ColorField label="Color (hex)" value={wardColor} onChangeText={setWardColor} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={editingWardId ? 'Save Changes' : 'Add Ward'} onPress={saveWard} loading={savingWard} />
            </View>
            {editingWardId ? (
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={resetWardForm} disabled={savingWard} />
              </View>
            ) : null}
          </View>
        </View>
        {wards.map((w) => (
          <View key={w.id} style={[styles.pendingRow, { flexDirection: 'row', alignItems: 'center' }]}>
            <Chip label={`${w.name} · ${w.bank_code}`} color={w.color} selected />
            <View style={{ flex: 1 }} />
            <Text style={styles.approveBtn} onPress={() => startEditWard(w)}>
              Edit
            </Text>
            <Text style={[styles.denyBtn, { marginLeft: 8 }]} onPress={() => removeWard(w)}>
              Remove
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{editingLeagueId ? 'Edit League / Organisation' : 'Add a League / Organisation'}</Text>
        <View style={{ gap: 10 }}>
          {editingLeagueId ? (
            <Text style={styles.pendingDetail}>Key: {leagueKey} (can't be changed — used to link badge artwork)</Text>
          ) : (
            <Field label="Key" value={leagueKey} onChangeText={setLeagueKey} placeholder="e.g. YOUTH (short, stable, no spaces)" autoCapitalize="characters" />
          )}
          <Field label="Label" value={leagueLabel} onChangeText={setLeagueLabel} placeholder="e.g. Youth League" />
          <Field label="Info (optional)" value={leagueInfo} onChangeText={setLeagueInfo} placeholder="Short description" />
          <ColorField label="Color (hex)" value={leagueColor} onChangeText={setLeagueColor} />
          <ChipRow label="Has badge artwork?" value={leagueHasBadge} onChange={setLeagueHasBadge} allowDeselect={false} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={editingLeagueId ? 'Save Changes' : 'Add League'} onPress={saveLeague} loading={savingLeague} />
            </View>
            {editingLeagueId ? (
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={resetLeagueForm} disabled={savingLeague} />
              </View>
            ) : null}
          </View>
        </View>
        {leagues.map((l) => (
          <View key={l.id} style={[styles.pendingRow, { flexDirection: 'row', alignItems: 'center' }]}>
            <Chip label={l.label} color={l.color} selected />
            <View style={{ flex: 1 }} />
            <Text style={styles.approveBtn} onPress={() => startEditLeague(l)}>
              Edit
            </Text>
            <Text style={[styles.denyBtn, { marginLeft: 8 }]} onPress={() => removeLeague(l)}>
              Remove
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>{editingAccountId ? 'Edit Bank Account' : 'Add a Bank Account'}</Text>
        <View style={{ gap: 10 }}>
          <Field label="Account Name" value={accountName} onChangeText={setAccountName} placeholder="e.g. General" />
          <Field label="Bank" value={bankName} onChangeText={setBankName} placeholder="e.g. Standard Bank" />
          <Field label="Account Number" value={accountNumber} onChangeText={setAccountNumber} placeholder="e.g. 012 165 778" />
          <Field label="Branch Code" value={branchCode} onChangeText={setBranchCode} placeholder="e.g. 012 345" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={editingAccountId ? 'Save Changes' : 'Add Account'} onPress={saveAccount} loading={savingAccount} />
            </View>
            {editingAccountId ? (
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={resetAccountForm} disabled={savingAccount} />
              </View>
            ) : null}
          </View>
        </View>
        {bankAccounts.map((a) => (
          <View key={a.id} style={styles.pendingRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.g800 }}>
                {a.name} — {a.bank_name}
              </Text>
              <Text style={styles.approveBtn} onPress={() => startEditAccount(a)}>
                Edit
              </Text>
              <Text style={[styles.denyBtn, { marginLeft: 8 }]} onPress={() => removeAccount(a)}>
                Remove
              </Text>
            </View>
            <Text style={styles.pendingDetail}>
              Acc. {a.account_number} · Branch {a.branch_code}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.cardTitle}>{editingCodeId ? 'Edit Payment Reference Code' : 'Add a Payment Reference Code'}</Text>
        <View style={{ gap: 10 }}>
          <Field label="Code" value={codeValue} onChangeText={setCodeValue} placeholder="e.g. PLG" autoCapitalize="characters" />
          <Field label="Label" value={codeLabel} onChangeText={setCodeLabel} placeholder="e.g. Pledge & Tithe" />
          <SelectField label="Account" value={codeAccountId} onChange={setCodeAccountId} options={bankAccounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Select an account…" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={editingCodeId ? 'Save Changes' : 'Add Code'} onPress={saveCode} loading={savingCode} />
            </View>
            {editingCodeId ? (
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={resetCodeForm} disabled={savingCode} />
              </View>
            ) : null}
          </View>
        </View>
        {paymentCodes.map((c) => (
          <View key={c.id} style={[styles.pendingRow, { flexDirection: 'row', alignItems: 'center' }]}>
            <Text style={{ flex: 1, fontSize: 13.5, color: colors.text }}>
              {c.code} — {c.label} ({bankAccounts.find((a) => a.id === c.account_id)?.name ?? 'Unknown account'})
            </Text>
            <Text style={styles.approveBtn} onPress={() => startEditCode(c)}>
              Edit
            </Text>
            <Text style={[styles.denyBtn, { marginLeft: 8 }]} onPress={() => removeCode(c)}>
              Remove
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  )
}
