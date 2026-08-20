import { useEffect, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import * as QueryParams from 'expo-auth-session/build/QueryParams'
import { Button, Field, GlassSheen, glassBlur } from '../components/ui'
import { ChurchHeader } from '../components/church-header'
import { supabase } from '../lib/supabase'
import { colors, radius } from '../theme'
import { styles } from '../styles/reset-password.styles'

export { ErrorBoundary } from '../components/error-boundary'

const INVALID_LINK_MESSAGE = 'This reset link is invalid or has expired. Request a new one from the sign-in screen.'

export default function ResetPassword() {
  const [checking, setChecking] = useState(true)
  const [linkError, setLinkError] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    let hadSpecificError = false

    async function tryUrl(url: string | null) {
      if (!url) return
      const { params, errorCode } = QueryParams.getQueryParams(url)
      if (errorCode) {
        hadSpecificError = true
        if (!cancelled) setLinkError(INVALID_LINK_MESSAGE)
        return
      }
      if (params.access_token && params.refresh_token) {
        await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token })
      }
    }

    async function finish() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (!data.session && !hadSpecificError) setLinkError(INVALID_LINK_MESSAGE)
      setChecking(false)
    }

    async function init() {
      // Web: the Supabase client already parsed the URL itself (detectSessionInUrl: true).
      // Native: there's no browser URL bar to auto-detect from, so we do it ourselves
      // from the deep link that opened the app.
      if (Platform.OS !== 'web') {
        await tryUrl(await Linking.getInitialURL())
      }
      await finish()
    }

    init()

    // Covers the app already being open in the background when the link is tapped.
    const sub = Linking.addEventListener('url', ({ url }) => {
      tryUrl(url).then(finish)
    })

    return () => {
      cancelled = true
      sub.remove()
    }
  }, [])

  async function onSubmit() {
    setFormError('')
    if (!password || password.length < 6) return setFormError('Password must be at least 6 characters.')
    if (password !== password2) return setFormError('Passwords do not match.')
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setDone(true)
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ChurchHeader title="Reset Password" showSeason={false} />

        <View style={[styles.card, glassBlur]}>
          <GlassSheen cornerRadius={radius.xl} />
          {checking ? (
            <View style={styles.checkingBox}>
              <ActivityIndicator color={colors.g700} />
            </View>
          ) : done ? (
            <>
              <Text style={styles.notice}>Your password has been updated.</Text>
              <Button title="Continue to the App" onPress={() => router.replace('/')} />
            </>
          ) : linkError ? (
            <>
              <Text style={styles.error}>{linkError}</Text>
              <Button title="Back to Sign In" variant="secondary" onPress={() => router.replace('/login')} />
            </>
          ) : (
            <>
              {formError ? <Text style={styles.error}>{formError}</Text> : null}
              <Field label="New Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
              <Field label="Confirm New Password" value={password2} onChangeText={setPassword2} secureTextEntry placeholder="••••••••" />
              <Button title="Set New Password" onPress={onSubmit} loading={saving} />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
