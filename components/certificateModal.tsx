import { useEffect, useRef, useState } from 'react'
import { Image, Modal, Platform, ScrollView, Text, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Alert } from '../lib/alert'
import { Button, formatDate } from './ui'
import { LeagueBadge } from './leagueBadge'
import { supabase } from '../lib/supabase'
import { applicationDetailText, type AnyApplication } from '../lib/applicationDetail'
import { styles } from './certificateModal.styles'
import type { BaptismApplication, CeremonyKind, LeagueRow } from '../lib/types'

const TITLES: Record<CeremonyKind, string> = {
  baptism: 'Certificate of Holy Baptism',
  confirmation: 'Certificate of Confirmation',
  league: 'Certificate of Installation',
}

function bodyLine(kind: CeremonyKind, leagueLabel?: string): string {
  if (kind === 'baptism') return 'was received into the family of Christ through Holy Baptism'
  if (kind === 'confirmation') return 'affirmed their baptismal faith and was confirmed as a full member of the church'
  return `was installed as a member of the ${leagueLabel ?? 'league'}`
}

type DetailRow = { label: string; value: string }

// "On {date} at {place}" / "On {date}" / "At {place}" — omits the row
// entirely (returns null) rather than printing a label with nothing after
// it when neither half is known.
function onAtRow(label: string, dateIso: string | null | undefined, place: string | null | undefined): DetailRow | null {
  const datePart = dateIso ? formatDate(dateIso) : null
  if (datePart && place) return { label, value: `On ${datePart} at ${place}` }
  if (datePart) return { label, value: `On ${datePart}` }
  if (place) return { label, value: `At ${place}` }
  return null
}

function plainRow(label: string, value: string | null | undefined): DetailRow | null {
  return value && value.trim() ? { label, value: value.trim() } : null
}

/**
 * Viewable/downloadable certificate for a granted baptism, confirmation, or
 * league installation. The ceremony date shown prefers the actual confirmed
 * ceremony_proposals row (the real, agreed-on date) over reviewed_at or the
 * original application's submitted_at, since a proposal is the only place an
 * exact ceremony date is ever recorded — see supabase/migrations/0010.
 *
 * Baptism and league certificates are laid out to resemble the parish's
 * actual paper certificates (verse quote, signature lines, structured
 * detail rows) — see supabase/migrations/0022_certificate_details.sql for
 * where that detail comes from. Confirmation has no paper template to work
 * from yet, so it keeps the original plain layout unchanged.
 */
export function CertificateModal({
  visible,
  onClose,
  kind,
  subjectId,
  isDependent,
  name,
  application,
  reviewedAt,
  league,
  dateOfBirth,
}: {
  visible: boolean
  onClose: () => void
  kind: CeremonyKind
  subjectId: string
  isDependent: boolean
  name: string
  application: AnyApplication | null | undefined
  reviewedAt: string | null
  league?: LeagueRow | null
  dateOfBirth?: string | null
}) {
  const [ceremonyDate, setCeremonyDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const paperRef = useRef<View>(null)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    supabase
      .from('ceremony_proposals')
      .select('ceremony_date')
      .eq(isDependent ? 'subject_dependent_id' : 'subject_profile_id', subjectId)
      .eq('kind', kind)
      .eq('status', 'confirmed')
      .order('ceremony_date', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setCeremonyDate((data?.[0] as { ceremony_date: string } | undefined)?.ceremony_date ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [visible, subjectId, kind, isDependent])

  const displayDate = ceremonyDate ?? reviewedAt?.slice(0, 10) ?? application?.submitted_at?.slice(0, 10) ?? null
  const detail = kind === 'league' ? null : applicationDetailText(kind, application)

  const baptismApp = kind === 'baptism' ? (application as BaptismApplication | null | undefined) : null
  const baptismRows: DetailRow[] = kind === 'baptism'
    ? ([
        onAtRow('Born', dateOfBirth, baptismApp?.birth_place),
        onAtRow('Baptized', displayDate, baptismApp?.location),
        plainRow('Officiated By', baptismApp?.officiant_name),
        plainRow('Register No.', baptismApp?.register_no),
        plainRow('Parish', 'Tshwane City'),
        plainRow('Diocese', baptismApp?.diocese),
        plainRow('Parents', baptismApp?.parents),
      ].filter(Boolean) as DetailRow[])
    : []

  const verseText = kind === 'baptism' ? baptismApp?.verse_text : kind === 'league' ? league?.verse_text : null
  const verseReference = kind === 'baptism' ? baptismApp?.verse_reference : kind === 'league' ? league?.verse_reference : null

  async function handleSave() {
    setSaving(true)
    try {
      const uri = await captureRef(paperRef, { format: 'png', quality: 1, result: Platform.OS === 'web' ? 'data-uri' : 'tmpfile' })
      if (Platform.OS === 'web') {
        const link = document.createElement('a')
        link.href = uri
        link.download = `${name.replace(/\s+/g, '-')}-${kind}-certificate.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save or share certificate' })
      } else {
        Alert.alert('Sharing not available', 'This device cannot save or share files.')
      }
    } catch (e) {
      Alert.alert('Could not save certificate', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View ref={paperRef} style={styles.paper} collapsable={false}>
          <View style={styles.paperInner}>
            <Image source={require('../assets/brand/churchLogo.png')} style={styles.crest} resizeMode="contain" />
            <Text style={styles.kicker}>ELCSA Tshwane City Parish</Text>
            <Text style={styles.parishName}>Growing Together in Christ</Text>
            <View style={styles.rule} />
            <Text style={styles.title}>{TITLES[kind]}</Text>
            <Text style={styles.bodyLine}>This certifies that</Text>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.bodyLine}>{bodyLine(kind, league?.label)}</Text>

            {verseText ? (
              <View style={styles.verseBlock}>
                <Text style={styles.verseText}>&ldquo;{verseText}&rdquo;</Text>
                {verseReference ? <Text style={styles.verseRef}>— {verseReference}</Text> : null}
              </View>
            ) : null}

            {kind === 'confirmation' && detail ? <Text style={styles.detail}>{detail}</Text> : null}

            {kind === 'baptism' && baptismRows.length > 0 ? (
              <View style={styles.detailsGrid}>
                {baptismRows.map((row) => (
                  <View key={row.label} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{row.label}</Text>
                    <Text style={styles.detailValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {kind === 'league' && league ? <LeagueBadge leagueKey={league.key} size={56} /> : null}

            {kind !== 'baptism' && displayDate ? <Text style={styles.date}>{formatDate(displayDate)}</Text> : null}

            {kind === 'league' && (league?.chairperson_name || league?.pastor_name) ? (
              <View style={styles.signatureRow}>
                {league?.chairperson_name ? (
                  <View style={styles.signatureBlock}>
                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureName}>{league.chairperson_name}</Text>
                    <Text style={styles.signatureCaption}>{league.label} Chairperson</Text>
                  </View>
                ) : null}
                {league?.pastor_name ? (
                  <View style={styles.signatureBlock}>
                    <View style={styles.signatureLine} />
                    <Text style={styles.signatureName}>{league.pastor_name}</Text>
                    <Text style={styles.signatureCaption}>Parish Pastor</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View style={styles.seal}>
              {kind === 'confirmation' ? (
                <Text style={styles.sealCross}>✝</Text>
              ) : (
                <Image source={require('../assets/brand/churchLogo.png')} style={styles.sealImage} resizeMode="contain" />
              )}
            </View>
            <Text style={styles.footer}>ELCSA Tshwane City Parish · Growing Together in Christ</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button title={Platform.OS === 'web' ? 'Download Certificate' : 'Save / Share Certificate'} onPress={handleSave} loading={saving} />
          <Button title="Close" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  )
}
