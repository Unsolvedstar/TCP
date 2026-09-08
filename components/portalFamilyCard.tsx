import { useCallback, useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Alert } from '../lib/alert'
import { Button, Card, Field } from './ui'
import { styles } from './portalFamilyCard.styles'
import { supabase } from '../lib/supabase'

type MyFamily = { id: string; name: string; code: string }
type RelativeMatch = { profile_id: string; full_name: string; ward_name: string }

// Every signup auto-mints its own family code now (see 0017), so `family`
// below is almost never null in practice — a fresh member is already the
// sole occupant of their own one-person household. The nudge exists so
// someone who actually has relatives already registered doesn't just keep
// that auto-generated household by default; it's shown once per device per
// user, tracked locally since it's a low-stakes UI reminder, not data.
function nudgeStorageKey(userId: string) {
  return `family-nudge-dismissed:${userId}`
}

/** The two ways to join a relative's family: a shared code, or picking them by name (0019). */
function JoinOptions({
  mode,
  onModeChange,
  code,
  onCodeChange,
  onJoinByCode,
  query,
  onQueryChange,
  results,
  searching,
  selected,
  onSelect,
  onJoinBySibling,
  busy,
}: {
  mode: 'code' | 'search'
  onModeChange: (m: 'code' | 'search') => void
  code: string
  onCodeChange: (v: string) => void
  onJoinByCode: () => void
  query: string
  onQueryChange: (v: string) => void
  results: RelativeMatch[]
  searching: boolean
  selected: RelativeMatch | null
  onSelect: (r: RelativeMatch | null) => void
  onJoinBySibling: () => void
  busy: boolean
}) {
  return (
    <View style={styles.joinForm}>
      <View style={styles.nudgeActions}>
        <View style={{ flex: 1 }}>
          <Button title="Enter a code" variant={mode === 'code' ? 'primary' : 'secondary'} onPress={() => onModeChange('code')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Search by name" variant={mode === 'search' ? 'primary' : 'secondary'} onPress={() => onModeChange('search')} />
        </View>
      </View>

      {mode === 'code' ? (
        <>
          <Field label="Relative's family code" value={code} onChangeText={onCodeChange} placeholder="e.g. AB12CD" autoCapitalize="characters" />
          <Button title="Join Family" onPress={onJoinByCode} loading={busy} disabled={!code.trim()} />
        </>
      ) : selected ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.nudgeText}>Join {selected.full_name}'s family?</Text>
          <View style={styles.nudgeActions}>
            <View style={{ flex: 1 }}>
              <Button title="Confirm" onPress={onJoinBySibling} loading={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Change" variant="secondary" onPress={() => onSelect(null)} />
            </View>
          </View>
        </View>
      ) : (
        <>
          <Field label="Relative's name" value={query} onChangeText={onQueryChange} placeholder="Start typing their name…" />
          {searching ? <Text style={styles.nudgeText}>Searching…</Text> : null}
          {results.map((r) => (
            <Text key={r.profile_id} style={styles.resultRow} onPress={() => onSelect(r)}>
              <Text style={styles.resultText}>{r.full_name}</Text>
              <Text style={styles.resultSub}>{'\n'}{r.ward_name} Ward</Text>
            </Text>
          ))}
          {!searching && query.trim().length >= 2 && results.length === 0 ? (
            <Text style={styles.nudgeText}>No matches found. Double-check the spelling, or ask them for their code instead.</Text>
          ) : null}
        </>
      )}
    </View>
  )
}

export function PortalFamilyCard() {
  const [family, setFamily] = useState<MyFamily | null>(null)
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [nudgeDismissed, setNudgeDismissed] = useState(true)
  const [joinMode, setJoinMode] = useState<'' | 'code' | 'search'>('')
  const [siblingQuery, setSiblingQuery] = useState('')
  const [siblingResults, setSiblingResults] = useState<RelativeMatch[]>([])
  const [searchingSiblings, setSearchingSiblings] = useState(false)
  const [selectedSibling, setSelectedSibling] = useState<RelativeMatch | null>(null)

  const load = useCallback(async () => {
    const [{ data }, {
      data: { user },
    }] = await Promise.all([supabase.rpc('my_family'), supabase.auth.getUser()])
    setFamily(((data as MyFamily[]) ?? [])[0] ?? null)
    setLoading(false)
    if (user) {
      setUserId(user.id)
      const dismissed = await AsyncStorage.getItem(nudgeStorageKey(user.id))
      setNudgeDismissed(dismissed === '1')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (joinMode !== 'search' || selectedSibling || siblingQuery.trim().length < 2) {
      setSiblingResults([])
      return
    }
    let cancelled = false
    setSearchingSiblings(true)
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_possible_relatives', { p_query: siblingQuery.trim() })
      if (!cancelled) {
        setSiblingResults((data as RelativeMatch[]) ?? [])
        setSearchingSiblings(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [joinMode, siblingQuery, selectedSibling])

  function resetJoinState() {
    setJoinMode('')
    setCode('')
    setSiblingQuery('')
    setSelectedSibling(null)
  }

  async function dismissNudge() {
    setNudgeDismissed(true)
    resetJoinState()
    if (userId) await AsyncStorage.setItem(nudgeStorageKey(userId), '1')
  }

  async function joinByCode() {
    setBusy(true)
    const { error } = await supabase.rpc('join_family_by_code', { p_code: code.trim() })
    setBusy(false)
    if (error) {
      Alert.alert('Could not join', error.message)
      return
    }
    await dismissNudge()
    await load()
  }

  async function joinBySibling() {
    if (!selectedSibling) return
    setBusy(true)
    const { error } = await supabase.rpc('join_sibling_family', { p_sibling_profile_id: selectedSibling.profile_id })
    setBusy(false)
    if (error) {
      Alert.alert('Could not join', error.message)
      return
    }
    await dismissNudge()
    await load()
  }

  if (loading) return null

  const joinOptions = (
    <JoinOptions
      mode={joinMode === 'search' ? 'search' : 'code'}
      onModeChange={setJoinMode}
      code={code}
      onCodeChange={(t) => setCode(t.toUpperCase())}
      onJoinByCode={joinByCode}
      query={siblingQuery}
      onQueryChange={setSiblingQuery}
      results={siblingResults}
      searching={searchingSiblings}
      selected={selectedSibling}
      onSelect={setSelectedSibling}
      onJoinBySibling={joinBySibling}
      busy={busy}
    />
  )

  return (
    <Card>
      <Text style={styles.cardTitle}>Family</Text>
      {family ? (
        <>
          <Text style={styles.cardSub}>Everyone sharing this code shows up together on the church's family record.</Text>
          <Text style={styles.familyName}>{family.name}</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Family code</Text>
            <Text style={styles.codeValue}>{family.code}</Text>
          </View>
          <Text style={styles.familyCodeHint}>Also doubles as your family's banking reference — see the Banking tab.</Text>

          {!nudgeDismissed && !joinMode ? (
            <View style={styles.nudgeBox}>
              <Text style={styles.nudgeText}>Already have relatives registered here? Join their family instead of keeping this one.</Text>
              <View style={styles.nudgeActions}>
                <View style={{ flex: 1 }}>
                  <Button title="Join a family" variant="secondary" onPress={() => setJoinMode('code')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="No, I'm on my own" variant="secondary" onPress={dismissNudge} />
                </View>
              </View>
            </View>
          ) : null}

          {joinMode ? joinOptions : null}
        </>
      ) : (
        <>
          <Text style={styles.cardSub}>
            Not part of a family yet. Enter a code from a relative, or search for them by name, to join automatically. It'll also bring in any children
            you've already added.
          </Text>
          <JoinOptions
            mode={joinMode === 'search' ? 'search' : 'code'}
            onModeChange={setJoinMode}
            code={code}
            onCodeChange={(t) => setCode(t.toUpperCase())}
            onJoinByCode={joinByCode}
            query={siblingQuery}
            onQueryChange={setSiblingQuery}
            results={siblingResults}
            searching={searchingSiblings}
            selected={selectedSibling}
            onSelect={setSelectedSibling}
            onJoinBySibling={joinBySibling}
            busy={busy}
          />
        </>
      )}
    </Card>
  )
}
