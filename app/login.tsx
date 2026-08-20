import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import * as Linking from 'expo-linking'
import { Button, Field, GlassSheen, glassBlur } from '../components/ui'
import { ChurchHeader } from '../components/church-header'
import { supabase } from '../lib/supabase'
import { radius } from '../theme'
import { styles } from '../styles/login.styles'

export { ErrorBoundary } from '../components/error-boundary'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetNotice, setResetNotice] = useState('')

  async function onSubmit() {
    setError('')
    if (!email || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    router.replace('/')
  }

  async function onSendReset() {
    setError('')
    setResetNotice('')
    if (!resetEmail.trim()) {
      setError('Enter the email address on your account.')
      return
    }
    setResetSending(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: Linking.createURL('/reset-password'),
    })
    setResetSending(false)
    if (err) {
      setError(err.message)
      return
    }
    setResetNotice("If that email has an account, we've sent a link to reset your password. Check your inbox.")
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ChurchHeader title="ELCSA Tshwane City Parish" subtitle="Growing Together in Christ" />

        {forgotOpen ? (
          <View style={[styles.card, glassBlur]}>
            <GlassSheen cornerRadius={radius.xl} />
            <Text style={styles.cardTitle}>Reset Password</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {resetNotice ? <Text style={styles.notice}>{resetNotice}</Text> : null}
            <Field label="Email" value={resetEmail} onChangeText={setResetEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
            <Button title="Send Reset Link" onPress={onSendReset} loading={resetSending} />
            <Text
              style={styles.forgotLink}
              onPress={() => {
                setForgotOpen(false)
                setError('')
                setResetNotice('')
              }}
            >
              ← Back to Sign In
            </Text>
          </View>
        ) : (
          <View style={[styles.card, glassBlur]}>
            <GlassSheen cornerRadius={radius.xl} />
            <Text style={styles.cardTitle}>Sign In</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            <Button title="Sign In" onPress={onSubmit} loading={loading} />
            <Text style={styles.forgotLink} onPress={() => setForgotOpen(true)}>
              Forgot your password?
            </Text>
            <Text style={styles.hint}>
              First time as parish admin? Use the email/password you set for the account created via the Supabase dashboard, then promote it to
              admin in the database.
            </Text>
          </View>
        )}

        <Link href="/register" asChild>
          <Pressable>
            <Text style={styles.registerLink}>New here? Create a member account →</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
