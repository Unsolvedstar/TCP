import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Modal, Platform, ScrollView, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Alert } from '../lib/alert'
import { Button } from './ui'
import { CertificatePaper } from './certificatePaper'
import { supabase } from '../lib/supabase'
import { useCongregationData } from '../lib/congregationContext'
import { applicationDetailText, type AnyApplication } from '../lib/applicationDetail'
import { styles } from './certificateModal.styles'
import type { CeremonyKind, LeagueRow } from '../lib/types'

// react-native-view-shot's web capture renders at the screen's pixel density and
// has no scale option, so on an ordinary monitor the download comes out ~480px
// wide — soft if printed. Render the sheet at 3x directly instead.
async function captureWebHighRes(node: unknown): Promise<string> {
  if (!node) throw new Error('Certificate is not ready yet.')
  const html2canvas = (await import('html2canvas-pro')).default
  const canvas = await html2canvas(node as HTMLElement, { scale: 3, useCORS: true, backgroundColor: '#ffffff' })
  return canvas.toDataURL('image/png')
}

/**
 * Viewable/downloadable certificate for a granted baptism, confirmation, or
 * league installation. The ceremony date shown prefers the actual confirmed
 * ceremony_proposals row (the real, agreed-on date) over reviewed_at or the
 * original application's submitted_at, since a proposal is the only place an
 * exact ceremony date is ever recorded — see supabase/migrations/0010.
 *
 * The sheet itself lives in certificatePaper.tsx and its vector artwork in
 * certificateArt.tsx; this modal only loads the ceremony date and handles
 * saving/sharing the rendered sheet as a PNG.
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
  const { congregation } = useCongregationData()
  const [ceremonyDate, setCeremonyDate] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const paperRef = useRef<ComponentRef<typeof View>>(null)

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
      .then(undefined, (err) => console.error('Failed to load ceremony date', err))
    return () => {
      cancelled = true
    }
  }, [visible, subjectId, kind, isDependent])

  const displayDate = ceremonyDate ?? reviewedAt?.slice(0, 10) ?? application?.submitted_at?.slice(0, 10) ?? null
  const detail = kind === 'confirmation' ? applicationDetailText(kind, application) : null

  async function handleSave() {
    setSaving(true)
    try {
      const uri = Platform.OS === 'web' ? await captureWebHighRes(paperRef.current) : await captureRef(paperRef, { format: 'png', quality: 1, result: 'tmpfile' })
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
        <CertificatePaper
          paperRef={paperRef}
          kind={kind}
          name={name}
          displayDate={displayDate}
          dateOfBirth={dateOfBirth}
          application={application}
          detail={detail}
          league={league}
          parishName={congregation?.name}
          parishAddress={congregation?.address}
        />

        <View style={styles.actions}>
          <Button title={Platform.OS === 'web' ? 'Download Certificate' : 'Save / Share Certificate'} onPress={handleSave} loading={saving} />
          <Button title="Close" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  )
}
