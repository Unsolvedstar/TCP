import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import { DateField, Field, SelectField } from '../components/ui'
import { ChurchHeader } from '../components/church-header'
import { SignaturePad } from '../components/signature-pad'
import { CertificatePicker } from '../components/certificate-picker'
import { Wizard, type WizardStepDef } from '../components/wizard'
import { supabase } from '../lib/supabase'
import { genders, leagueKeys, leagues, wards } from '../theme'
import { styles } from '../styles/register.styles'

export { ErrorBoundary } from '../components/error-boundary'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState('')
  const [ward, setWard] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState<string | null>(null)
  const [initialLeague, setInitialLeague] = useState('')
  const [alreadyBaptised, setAlreadyBaptised] = useState('')
  const [alreadyConfirmed, setAlreadyConfirmed] = useState('')
  const [baptismType, setBaptismType] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [mentorName, setMentorName] = useState('')
  const [leagueReason, setLeagueReason] = useState('')
  const [baptismCert, setBaptismCert] = useState<string | null>(null)
  const [confirmationCert, setConfirmationCert] = useState<string | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setError('')
    setNotice('')
    setLoading(true)
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          date_of_birth: dob,
          gender: gender || null,
          ward,
          initial_league: initialLeague || null,
          already_baptised: alreadyBaptised === 'yes',
          already_confirmed: alreadyConfirmed === 'yes',
          baptism_type: baptismType || null,
          sponsor_name: sponsorName.trim() || null,
          mentor_name: mentorName.trim() || null,
          league_reason: leagueReason.trim() || null,
          baptism_certificate: baptismCert,
          confirmation_certificate: confirmationCert,
          signature,
        },
      },
    })
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }
    if (!data.session) {
      setNotice('Account created! Check your email to confirm it, then sign in.')
      return
    }
    router.replace('/')
  }

  const steps: WizardStepDef[] = [
    {
      key: 'about',
      title: 'About You',
      subtitle: 'Tell us your name and which ward you belong to.',
      validate: () => {
        if (!fullName.trim()) return 'Please enter your full name.'
        if (!ward) return 'Please select your ward.'
        return null
      },
      render: () => (
        <>
          <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="e.g. Leshego Mogowe" />
          <SelectField
            label="Gender (optional)"
            value={gender}
            onChange={setGender}
            options={genders.map((g) => ({ value: g, label: g }))}
            placeholder="Select…"
          />
          <SelectField
            label="Ward"
            value={ward}
            onChange={setWard}
            options={wards.map((w) => ({ value: w, label: `${w} Ward` }))}
            placeholder="Select your ward…"
          />
        </>
      ),
    },
    {
      key: 'contact',
      title: 'Contact & Birthday',
      subtitle: 'Both optional — helps us reach you and celebrate with you.',
      render: () => (
        <>
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="072 000 0000" />
          <DateField label="Birthday (optional)" value={dob} maximumDate={new Date()} onChange={setDob} />
        </>
      ),
    },
    {
      key: 'involvement',
      title: 'Sacraments & League',
      subtitle: 'Already baptised, confirmed, or part of a league? Tell us now — this is recorded on your record right away, no approval needed.',
      validate: () => {
        if (alreadyConfirmed === 'yes' && alreadyBaptised !== 'yes') {
          return 'Confirmation always follows baptism — please also answer "Yes" to already baptised, or leave both blank if you\'re not sure.'
        }
        const claimingSomething = alreadyBaptised === 'yes' || alreadyConfirmed === 'yes' || !!initialLeague
        if (claimingSomething && !signature) {
          return 'Please sign below to confirm what you told us here is accurate.'
        }
        return null
      },
      render: () => (
        <>
          <SelectField
            label="Already baptised?"
            value={alreadyBaptised}
            onChange={setAlreadyBaptised}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No / Not yet' },
            ]}
            placeholder="Select…"
          />
          {alreadyBaptised === 'yes' ? (
            <>
              <SelectField
                label="Baptism type"
                value={baptismType}
                onChange={setBaptismType}
                options={[
                  { value: 'Infant', label: 'Infant' },
                  { value: 'Adult', label: 'Adult' },
                ]}
                placeholder="Select…"
              />
              <Field label="Sponsor / Godparent name" value={sponsorName} onChangeText={setSponsorName} placeholder="e.g. Thabo Mokoena" />
            </>
          ) : null}
          <SelectField
            label="Already confirmed?"
            value={alreadyConfirmed}
            onChange={setAlreadyConfirmed}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No / Not yet' },
            ]}
            placeholder="Select…"
          />
          {alreadyConfirmed === 'yes' ? (
            <>
              <Field label="Confirmation mentor (optional)" value={mentorName} onChangeText={setMentorName} placeholder="If you had one" />
              <CertificatePicker label="Baptism Certificate (optional, if applicable)" value={baptismCert} onChange={setBaptismCert} />
            </>
          ) : null}
          <SelectField
            label="League / Organisation (optional)"
            value={initialLeague}
            onChange={setInitialLeague}
            options={leagueKeys.map((k) => ({ value: k, label: leagues[k].label }))}
            placeholder="Select if you already belong to one…"
          />
          {initialLeague ? (
            <>
              <Field label="Why would you like to join? (optional)" value={leagueReason} onChangeText={setLeagueReason} placeholder="A short reason" />
              {alreadyConfirmed !== 'yes' ? <CertificatePicker label="Baptism Certificate (optional)" value={baptismCert} onChange={setBaptismCert} /> : null}
              <CertificatePicker label="Confirmation Certificate (optional)" value={confirmationCert} onChange={setConfirmationCert} />
            </>
          ) : null}
          {alreadyBaptised === 'yes' || alreadyConfirmed === 'yes' || initialLeague ? (
            <SignaturePad value={signature} onChange={setSignature} />
          ) : null}
        </>
      ),
    },
    {
      key: 'login',
      title: 'Create Your Login',
      subtitle: "You'll use this email and password to sign in.",
      validate: () => {
        if (!email.trim()) return 'Please enter your email.'
        if (!password || password.length < 6) return 'Password must be at least 6 characters.'
        if (password !== password2) return 'Passwords do not match.'
        return null
      },
      render: () => (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" />
          <Field label="Confirm Password" value={password2} onChangeText={setPassword2} secureTextEntry placeholder="••••••••" />
        </>
      ),
    },
  ]

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ChurchHeader title="Register" subtitle="ELCSA Tshwane City Parish" showSeason={false} />

        <View style={styles.card}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <Wizard steps={steps} onComplete={onSubmit} completeLabel="Create Account" submitting={loading} />
        </View>

        <Link href="/login" asChild>
          <Pressable>
            <Text style={styles.backLink}>← Back to Sign In</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
