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
import type { CeremonyKind } from '../lib/types'

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

/**
 * Viewable/downloadable certificate for a granted baptism, confirmation, or
 * league installation. The ceremony date shown prefers the actual confirmed
 * ceremony_proposals row (the real, agreed-on date) over reviewed_at or the
 * original application's submitted_at, since a proposal is the only place an
 * exact ceremony date is ever recorded — see supabase/migrations/0010.
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
}: {
  visible: boolean
  onClose: () => void
  kind: CeremonyKind
  subjectId: string
  isDependent: boolean
  name: string
  application: AnyApplication | null | undefined
  reviewedAt: string | null
  league?: { label: string; key: string } | null
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
            {detail ? <Text style={styles.detail}>{detail}</Text> : null}
            {kind === 'league' && league ? <LeagueBadge leagueKey={league.key} size={56} /> : null}
            {displayDate ? <Text style={styles.date}>{formatDate(displayDate)}</Text> : null}
            <View style={styles.seal}>
              <Text style={styles.sealCross}>✝</Text>
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
