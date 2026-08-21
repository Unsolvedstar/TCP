import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { Link, router } from 'expo-router'
import { DateField, Field, GlassSheen, glassBlur, SelectField } from '../components/ui'
import { ChurchHeader } from '../components/church-header'
import { SignaturePad } from '../components/signature-pad'
import { CertificatePicker } from '../components/certificate-picker'
import { ChipRow } from '../components/chip-row'
import { Wizard, type WizardStepDef } from '../components/wizard'
import { supabase } from '../lib/supabase'
import { getRegistrationCongregation } from '../lib/congregation'
import type { WardRow, LeagueRow } from '../lib/types'
import { genders, radius } from '../theme'
import { styles } from '../styles/register.styles'

export { ErrorBoundary } from '../components/error-boundary'

export default function Register() {
  const [congregationId, setCongregationId] = useState('')
  const [wards, setWards] = useState<WardRow[]>([])
  const [leagues, setLeagues] = useState<LeagueRow[]>([])
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    getRegistrationCongregation()
      .then(({ congregation, wards, leagues }) => {
        setCongregationId(congregation.id)
        setWards(wards)
        setLeagues(leagues)
      })
      .catch((err) => setLoadError(err.message ?? 'Could not load registration options.'))
  }, [])

  const [fullName, setFullName] = useState('')
  const [gender, setGender] = useState('')
  const [wardId, setWardId] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState<string | null>(null)
  const [initialLeagueId, setInitialLeagueId] = useState('')
  const [alreadyBaptised, setAlreadyBaptised] = useState('')
  const [alreadyConfirmed, setAlreadyConfirmed] = useState('')
  const [baptismType, setBaptismType] = useState('')
  const [sponsorName, setSponsorName] = useState('')
  const [baptismLocation, setBaptismLocation] = useState('')
  const [baptismOfficiant, setBaptismOfficiant] = useState('')
  const [mentorName, setMentorName] = useState('')
  const [confirmationLocation, setConfirmationLocation] = useState('')
  const [confirmationOfficiant, setConfirmationOfficiant] = useState('')
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
    if (!congregationId) {
      setError('Registration options are still loading. Please try again in a moment.')
      return
    }
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
          congregation_id: congregationId,
          ward_id: wardId,
          league_id: initialLeagueId || null,
          already_baptised: alreadyBaptised === 'yes',
          already_confirmed: alreadyConfirmed === 'yes',
          baptism_type: baptismType || null,
          sponsor_name: sponsorName.trim() || null,
          baptism_location: baptismLocation.trim() || null,
          baptism_officiant: baptismOfficiant.trim() || null,
          mentor_name: mentorName.trim() || null,
          confirmation_location: confirmationLocation.trim() || null,
          confirmation_officiant: confirmationOfficiant.trim() || null,
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
        if (!wardId) return 'Please select your ward.'
        return null
      },
      render: () => (
        <>
          <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="e.g. Tshedza Tshikovhi" />
          <SelectField
            label="Gender (optional)"
            value={gender}
            onChange={setGender}
            options={genders.map((g) => ({ value: g, label: g }))}
            placeholder="Select…"
          />
          <SelectField
            label="Ward"
            value={wardId}
            onChange={setWardId}
            options={wards.map((w) => ({ value: w.id, label: `${w.name} Ward` }))}
            placeholder="Select your ward…"
          />
        </>
      ),
    },
    {
      key: 'contact',
      title: 'Contact & Birthday',
      subtitle: 'Both optional, and help us reach you and celebrate with you.',
      render: () => (
        <>
          <Field label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0760293340" />
          <DateField label="Birthday (optional)" value={dob} maximumDate={new Date()} onChange={setDob} />
        </>
      ),
    },
    {
      key: 'involvement',
      title: 'Sacraments & League',
      subtitle: 'Already baptised, confirmed, or part of a league? Tell us now. It\'s recorded on your record right away, no approval needed.',
      validate: () => {
        if (alreadyConfirmed === 'yes' && alreadyBaptised !== 'yes') {
          return 'Confirmation always follows baptism. Please also answer "Yes" to already baptised, or leave both blank if you\'re not sure.'
        }
        const claimingSomething = alreadyBaptised === 'yes' || alreadyConfirmed === 'yes' || !!initialLeagueId
        if (claimingSomething && !signature) {
          return 'Please sign below to confirm what you told us here is accurate.'
        }
        return null
      },
      render: () => (
        <>
          <ChipRow
            label="Already baptised?"
            value={alreadyBaptised}
            onChange={setAlreadyBaptised}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No, not yet' },
            ]}
          />
          {alreadyBaptised === 'yes' ? (
            <>
              <ChipRow
                label="Baptism type"
                value={baptismType}
                onChange={setBaptismType}
                options={[
                  { value: 'Infant', label: 'Infant' },
                  { value: 'Adult', label: 'Adult' },
                ]}
              />
              <Field label="Sponsor / Godparent name (optional)" value={sponsorName} onChangeText={setSponsorName} placeholder="e.g. Tshedza Tshikovhi" />
              <Field label="Where were you baptised? (optional)" value={baptismLocation} onChangeText={setBaptismLocation} placeholder="e.g. Tshwane City Parish" />
              <Field label="Who baptised you? (optional, e.g. the pastor's name)" value={baptismOfficiant} onChangeText={setBaptismOfficiant} placeholder="Pastor's name" />
            </>
          ) : null}
          <ChipRow
            label="Already confirmed?"
            value={alreadyConfirmed}
            onChange={setAlreadyConfirmed}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No, not yet' },
            ]}
          />
          {alreadyConfirmed === 'yes' ? (
            <>
              <Field label="Confirmation mentor (optional)" value={mentorName} onChangeText={setMentorName} placeholder="If you had one" />
              <Field label="Where were you confirmed? (optional)" value={confirmationLocation} onChangeText={setConfirmationLocation} placeholder="e.g. Tshwane City Parish" />
              <Field label="Who confirmed you? (optional)" value={confirmationOfficiant} onChangeText={setConfirmationOfficiant} placeholder="Pastor's name" />
            </>
          ) : null}
          <ChipRow
            label="League / Organisation (optional — already belong to one?)"
            value={initialLeagueId}
            onChange={setInitialLeagueId}
            options={leagues.map((l) => ({ value: l.id, label: l.label, color: l.color }))}
          />
          {initialLeagueId ? (
            <>
              <Field label="Why would you like to join? (optional)" value={leagueReason} onChangeText={setLeagueReason} placeholder="A short reason" />
              {alreadyConfirmed !== 'yes' ? <CertificatePicker label="Baptism Certificate (optional)" value={baptismCert} onChange={setBaptismCert} /> : null}
              <CertificatePicker label="Confirmation Certificate (optional)" value={confirmationCert} onChange={setConfirmationCert} />
            </>
          ) : null}
          {alreadyBaptised === 'yes' || alreadyConfirmed === 'yes' || initialLeagueId ? (
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

        <View style={[styles.card, glassBlur]}>
          <GlassSheen cornerRadius={radius.xl} />
          {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
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
