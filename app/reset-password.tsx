import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Button, Field, GlassSheen, glassBlur } from '../components/ui'
import { ChurchHeader } from '../components/churchHeader'
import { supabase } from '../lib/supabase'
import { parseRecoveryParams, passwordProblem } from '../lib/passwordReset'
import { colors, radius } from '../theme'
import { styles } from '../styles/login.styles'
import { contentNarrow } from '../lib/layout'

export { ErrorBoundary } from '../components/errorBoundary'

type Stage = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPassword() {
  const [stage, setStage] = useState<Stage>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // The email link lands here carrying a one-time token. Turn it into a session so updateUser() is allowed.
  useEffect(() => {
    let cancelled = false
    async function establish() {
      if (typeof window === 'undefined') return setStage('invalid')
      const p = parseRecoveryParams(window.location.hash, window.location.search)
      let ok = false
      if (p.accessToken && p.refreshToken) {
        const { error: err } = await supabase.auth.setSession({ access_token: p.accessToken, refresh_token: p.refreshToken })
        ok = !err
      } else if (p.code) {
        const { error: err } = await supabase.auth.exchangeCodeForSession(p.code)
        ok = !err
      }
      // Drop the token from the address bar either way.
      window.history.replaceState(null, '', window.location.pathname)
      if (!cancelled) setStage(ok ? 'ready' : 'invalid')
    }
    establish().catch(() => !cancelled && setStage('invalid'))
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit() {
    setError('')
    const problem = passwordProblem(password, confirm)
    if (problem) return setError(problem)
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    if (err) {
      setLoading(false)
      return setError(err.message)
    }
    // Make them sign in with the new password, rather than leaving them signed in from an email link.
    await supabase.auth.signOut()
    setLoading(false)
    setStage('done')
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, contentNarrow]} keyboardShouldPersistTaps="handled">
        <ChurchHeader title="ELCSA Tshwane City Parish" subtitle="Growing Together in Christ" />
        <View style={[styles.card, glassBlur]}>
          <GlassSheen cornerRadius={radius.xl} />
          <Text style={styles.cardTitle}>Choose a new password</Text>
          {stage === 'checking' ? <ActivityIndicator color={colors.g700} /> : null}
          {stage === 'invalid' ? (
            <>
              <Text style={styles.error}>This reset link is not valid any more. Links work once and expire after a short time.</Text>
              <Button title="Send me a new link" onPress={() => router.replace('/forgot-password')} />
            </>
          ) : null}
          {stage === 'ready' ? (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" />
              <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="••••••••" />
              <Button title="Save new password" onPress={onSubmit} loading={loading} />
            </>
          ) : null}
          {stage === 'done' ? (
            <>
              <Text style={styles.notice}>Your password has been changed. Sign in with your new password.</Text>
              <Button title="Go to Sign In" onPress={() => router.replace('/login')} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
