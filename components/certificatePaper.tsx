import type { ComponentRef, Ref } from 'react'
import { Text, View } from 'react-native'
import { colors } from '../theme'
import { formatDate } from './ui'
import { BaptismArch, CertificateFrame, ConfirmationEmblem, LeagueEmblem, OrnamentRule, RoundSeal } from './certificateArt'
import { INK, styles } from './certificatePaper.styles'
import type { AnyApplication } from '../lib/applicationDetail'
import { resolveVerse, type CertificateVerse } from '../lib/certificateVerse'
import type { BaptismApplication, CeremonyKind, LeagueRow } from '../lib/types'

export const CERTIFICATE_TITLES: Record<CeremonyKind, string> = {
  baptism: 'Baptismal Certificate',
  confirmation: 'Certificate of Confirmation',
  league: 'Certificate of Installation',
}

const FALLBACK_PARISH = 'ELCSA Tshwane City Parish'
const CHURCH_NAME = 'Evangelical Lutheran Church in Southern Africa'
const TAGLINE = 'Growing Together in Christ'

type DetailCell = { label: string; value: string; full?: boolean }

function cell(label: string, value: string | null | undefined, full = false): DetailCell | null {
  return value && value.trim() ? { label, value: value.trim(), full } : null
}

function dateCell(label: string, dateIso: string | null | undefined): DetailCell | null {
  return dateIso ? { label, value: formatDate(dateIso) } : null
}

function bodyLine(kind: CeremonyKind, leagueLabel?: string): string {
  if (kind === 'confirmation') return 'affirmed their baptismal faith and was confirmed as a full member of the church'
  return `was installed as a member of the ${leagueLabel ?? 'league'}`
}

// The parish stamp: congregation name round the top, tagline round the bottom.
function ParishSeal({ size, parishName }: { size: number; parishName: string }) {
  return <RoundSeal size={size} color={INK} topText={parishName.toUpperCase()} bottomText="GROWING TOGETHER IN CHRIST" topSweep={176} filled={false} />
}

// The ELCSA emblem.
function Crest({ size }: { size: number }) {
  return <RoundSeal size={size} color={colors.g700} topText="EVANGELICAL LUTHERAN CHURCH" bottomText="IN SOUTHERN AFRICA" topSweep={236} />
}

// Every certificate carries a verse — see lib/certificateVerse.ts for where it comes from.
function Verse({ verse, plain }: { verse: CertificateVerse; plain?: boolean }) {
  if (plain) {
    // The baptism paper prints it as a run-in line: Text: "…". Psalm 25:1-3
    // The full stop moves outside the closing quote, so drop the verse's own.
    const text = verse.reference ? verse.text.replace(/\.\s*$/, '') : verse.text
    return (
      <Text style={styles.baptismVerse}>
        Text: &ldquo;{text}&rdquo;{verse.reference ? `. ${verse.reference}` : ''}
      </Text>
    )
  }
  return (
    <View style={styles.verseBlock}>
      <View style={styles.verseRule}>
        <OrnamentRule width={150} color={INK} />
      </View>
      <Text style={styles.verseText}>&ldquo;{verse.text}&rdquo;</Text>
      {verse.reference ? <Text style={styles.verseRef}>{verse.reference}</Text> : null}
    </View>
  )
}

// The ELCSA crest, very faint, centred behind the content — the way printed
// certificates carry a watermark. Purely decorative.
function Watermark() {
  return (
    <View pointerEvents="none" style={styles.watermark}>
      <RoundSeal size={300} color={colors.g700} topText="EVANGELICAL LUTHERAN CHURCH" bottomText="IN SOUTHERN AFRICA" topSweep={236} />
    </View>
  )
}

/**
 * The certificate sheet itself, with no data fetching, so it can be rendered
 * (and previewed) from plain props. Baptism and league installation follow the
 * parish's paper certificates; confirmation has no paper template yet and gets
 * a simple layout in the same visual language.
 */
export function CertificatePaper({
  paperRef,
  kind,
  name,
  displayDate,
  dateOfBirth,
  application,
  detail,
  league,
  parishName,
  parishAddress,
}: {
  paperRef?: Ref<ComponentRef<typeof View>>
  kind: CeremonyKind
  name: string
  displayDate: string | null
  dateOfBirth?: string | null
  application?: AnyApplication | null
  // One-line summary of a confirmation, already formatted by the caller.
  detail?: string | null
  league?: LeagueRow | null
  parishName?: string | null
  parishAddress?: string | null
}) {
  const parish = parishName?.trim() || FALLBACK_PARISH

  if (kind === 'baptism') {
    const app = application as BaptismApplication | null | undefined
    const cells = [
      dateCell('Born on', dateOfBirth),
      cell('at', app?.birth_place),
      dateCell('Baptized on', displayDate),
      cell('at', app?.location),
      cell('By', app?.officiant_name),
      cell('Register No', app?.register_no),
      cell('Parish', parish),
      cell('Diocese', app?.diocese),
      cell('Parents', app?.parents, true),
      cell('Sponsors', app?.sponsor_name, true),
    ].filter(Boolean) as DetailCell[]

    return (
      <View ref={paperRef} style={styles.paper} collapsable={false}>
        <Watermark />
        <View style={styles.baptismRuleTop} />
        <View style={styles.baptismRuleBottom} />
        <View style={styles.baptismBody}>
          <Text style={styles.baptismHeading}>Evangelical Lutheran Church</Text>
          <Text style={styles.baptismHeading}>in Southern Africa</Text>
          <Text style={styles.baptismTitle}>Baptismal Certificate</Text>
          <BaptismArch width={300} color={INK} />
          <Verse verse={resolveVerse('baptism', { text: app?.verse_text, reference: app?.verse_reference })} plain />

          <View style={styles.certifyBlock}>
            <Text style={styles.certifyLead}>It is hereby certified that</Text>
            <Text style={styles.certifyName}>{name}</Text>
            <Text style={styles.certifyLead}>was baptized</Text>
          </View>

          <View style={styles.detailsGrid}>
            {cells.map((c, i) => (
              <View key={`${c.label}-${i}`} style={c.full ? styles.detailFull : styles.detailHalf}>
                <Text style={styles.detailText}>
                  <Text style={styles.detailLabel}>{c.label}: </Text>
                  {c.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.baptismSignRow}>
            <View style={[styles.baptismSignCell, { flex: 1.4 }]}>
              <Text style={styles.baptismSignValue}> </Text>
              <Text style={styles.baptismSignCaption}>Signature</Text>
            </View>
            <View style={styles.baptismSignCell}>
              <Text style={styles.baptismSignValue}>{app?.location ?? ' '}</Text>
              <Text style={styles.baptismSignCaption}>Place</Text>
            </View>
            <View style={styles.baptismSignCell}>
              <Text style={styles.baptismSignValue}>{displayDate ? formatDate(displayDate) : ' '}</Text>
              <Text style={styles.baptismSignCaption}>Date</Text>
            </View>
          </View>

          <View style={styles.baptismFooterRow}>
            <ParishSeal size={78} parishName={parish} />
            <Crest size={78} />
          </View>
          <Text style={styles.baptismFooterCaption}>{CHURCH_NAME}</Text>
        </View>
      </View>
    )
  }

  if (kind === 'league') {
    return (
      <View ref={paperRef} style={styles.paper} collapsable={false}>
        <Watermark />
        <CertificateFrame color={INK} />
        <View style={styles.body}>
          <View style={styles.leagueTopRow}>
            <Crest size={74} />
            {league ? <LeagueEmblem size={70} label={league.label} /> : <View />}
          </View>
          <Text style={styles.headerBold}>{CHURCH_NAME}</Text>
          <Text style={styles.headerBold}>{parish}</Text>
          {parishAddress ? <Text style={styles.headerBold}>{parishAddress}</Text> : null}
          <View style={{ marginTop: 14 }}>
            <OrnamentRule width={170} color={INK} />
          </View>

          <Text style={styles.leagueName}>{league?.label ?? 'League'}</Text>
          <Text style={styles.scriptName}>{name}</Text>
          <View style={styles.dottedLine} />
          {displayDate ? <Text style={styles.installDate}>Installation date: {formatDate(displayDate)}</Text> : null}

          <Verse verse={resolveVerse('league', { text: league?.verse_text, reference: league?.verse_reference })} />

          <View style={styles.signatureRow}>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              {league?.pastor_name ? <Text style={styles.signatureName}>{league.pastor_name}</Text> : null}
              <Text style={styles.signatureCaption}>Parish Pastor</Text>
            </View>
            <View style={styles.signatureSeal}>
              <ParishSeal size={80} parishName={parish} />
            </View>
            <View style={styles.signatureBlock}>
              <View style={styles.signatureLine} />
              {league?.chairperson_name ? <Text style={styles.signatureName}>{league.chairperson_name}</Text> : null}
              <Text style={styles.signatureCaption}>Chairperson</Text>
            </View>
          </View>
        </View>
      </View>
    )
  }

  // Confirmation — no paper template to follow yet, so this is the same line-art
  // language as the other two, with its own emblem.
  return (
    <View ref={paperRef} style={styles.paper} collapsable={false}>
      <Watermark />
      <CertificateFrame color={INK} />
      <View style={styles.body}>
        <Crest size={60} />
        <Text style={[styles.kicker, { marginTop: 8 }]}>{parish}</Text>
        <Text style={styles.tagline}>{TAGLINE}</Text>
        <Text style={styles.title}>{CERTIFICATE_TITLES[kind]}</Text>
        <ConfirmationEmblem width={150} color={INK} leaf={colors.g700} flame={colors.brandRed} />
        <Text style={[styles.bodyLine, { marginTop: 10 }]}>This certifies that</Text>
        <Text style={styles.scriptName}>{name}</Text>
        <View style={styles.dottedLine} />
        <Text style={styles.bodyLine}>{bodyLine(kind, league?.label)}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {displayDate ? <Text style={styles.installDate}>{formatDate(displayDate)}</Text> : null}

        <Verse verse={resolveVerse('confirmation')} />

        <View style={styles.signatureRow}>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>Parish Pastor</Text>
          </View>
          <View style={styles.signatureSeal}>
            <ParishSeal size={80} parishName={parish} />
          </View>
          <View style={styles.signatureBlock}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureCaption}>Date</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
