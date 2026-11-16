import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Button, Field, GlassSheen, glassBlur } from '../components/ui'
import { ChurchHeader } from '../components/churchHeader'
import { supabase } from '../lib/supabase'
import { resetRedirectUrl } from '../lib/passwordReset'
import { radius } from '../theme'
import { styles } from '../styles/login.styles'
import { contentNarrow } from '../lib/layout'

export { ErrorBoundary } from '../components/errorBoundary'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setError('')
    if (!email.trim()) {
      setError('Enter the email you registered with.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetRedirectUrl() })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    // Same message whether or not the email exists, so this cannot be used to find out who is registered.
    setSent(true)
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, contentNarrow]} keyboardShouldPersistTaps="handled">
        <ChurchHeader title="ELCSA Tshwane City Parish" subtitle="Growing Together in Christ" />
        <View style={[styles.card, glassBlur]}>
          <GlassSheen cornerRadius={radius.xl} />
          <Text style={styles.cardTitle}>Reset your password</Text>
          {sent ? (
            <>
              <Text style={styles.notice}>
                If that email is registered, we have sent a link to it. Open the link to choose a new password. Check your spam folder too.
              </Text>
              <Button title="Back to Sign In" onPress={() => router.replace('/login')} />
            </>
          ) : (
            <>
              <Text style={styles.hint}>Enter your email and we will send you a link to choose a new password.</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
              <Button title="Send reset link" onPress={onSubmit} loading={loading} />
              <Button title="Back to Sign In" variant="secondary" onPress={() => router.replace('/login')} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
