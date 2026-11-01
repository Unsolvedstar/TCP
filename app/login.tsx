import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { Button, Field, GlassSheen, glassBlur, ActionButton } from '../components/ui'
import { ChurchHeader } from '../components/churchHeader'
import { supabase } from '../lib/supabase'
import { radius } from '../theme'
import { styles } from '../styles/login.styles'
import { contentNarrow } from '../lib/layout'
import { InstallAppButton } from '../components/installAppButton'

export { ErrorBoundary } from '../components/errorBoundary'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, contentNarrow]} keyboardShouldPersistTaps="handled">
        <ChurchHeader title="ELCSA Tshwane City Parish" subtitle="Growing Together in Christ" />

        <View style={[styles.card, glassBlur]}>
          <GlassSheen cornerRadius={radius.xl} />
          <Text style={styles.cardTitle}>Sign In</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
          <Button title="Sign In" onPress={onSubmit} loading={loading} />
          <Text style={styles.hint}>Forgot your password? Ask the parish office to reset it for you.</Text>
        </View>

        <View style={{ marginTop: 20 }}>
          <Button title="New here? Create a member account" variant="secondary" onPress={() => router.push('/register')} />
        </View>
        <View style={{ marginTop: 12 }}>
          <InstallAppButton />
        </View>
        <View style={{ marginTop: 12, alignItems: 'center' }}>
          <ActionButton label="Privacy Policy" onPress={() => router.push('/privacy')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
