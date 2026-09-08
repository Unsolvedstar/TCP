import { useState } from 'react'
import { Image, Modal, ScrollView, Text, View } from 'react-native'
import { Button, Chip, formatDate } from './ui'
import { CertificateModal } from './certificateModal'
import { BaptismCertificateDetailsModal } from './baptismCertificateDetailsModal'
import { styles } from './memberProfileModal.styles'
import { colors } from '../theme'
import { classifyAge, AGE_GROUP_LABELS } from '../lib/ageGroups'
import { applicationDetailText, applicationCertificateList } from '../lib/applicationDetail'
import type { CeremonyKind, ChildRow, Household, LeagueRow, Profile, WardRow } from '../lib/types'

const AGE_GROUP_COLORS = { child: '#c1447e', adult: colors.g700, elder: colors.brandNavy } as const

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)))
}

/** Read-focused "everything about this member" view — Edit stays a separate action, opening EditMemberModal. */
export function MemberProfileModal({
  member,
  ward,
  league,
  household,
  familyMembers,
  familyDependents,
  leagueAdminFor,
  onClose,
  onEdit,
  onChanged,
}: {
  member: Profile
  ward?: WardRow
  league?: LeagueRow
  household: Household | null
  familyMembers: Profile[]
  familyDependents: ChildRow[]
  leagueAdminFor: LeagueRow[]
  onClose: () => void
  onEdit: () => void
  onChanged: () => void
}) {
  const [certKind, setCertKind] = useState<CeremonyKind | null>(null)
  const [editingBaptismCert, setEditingBaptismCert] = useState(false)
  const ageGroup = classifyAge(member.date_of_birth)
  const baptismDetail = applicationDetailText('baptism', member.baptism_application)
  const confirmationDetail = applicationDetailText('confirmation', member.confirmation_application)
  const certificates = [
    ...applicationCertificateList(member.baptism_application),
    ...applicationCertificateList(member.confirmation_application),
    ...applicationCertificateList(member.league_application),
  ]
  const daysActive = daysSince(member.last_active_at)

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.cream }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
        <Text style={styles.name}>{member.full_name}</Text>
        <View style={styles.chipsRow}>
          {ward ? <Chip label={ward.name} color={ward.color} /> : null}
          {ageGroup ? <Chip label={AGE_GROUP_LABELS[ageGroup]} color={AGE_GROUP_COLORS[ageGroup]} /> : null}
          {member.gender ? <Chip label={member.gender} color={colors.g700} /> : null}
          <Chip label={member.baptised ? 'Baptised' : 'Not Baptised'} color={member.baptised ? colors.g700 : colors.muted} />
          <Chip label={member.confirmed ? 'Confirmed' : 'Not Confirmed'} color={member.confirmed ? colors.g700 : colors.muted} />
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Contact</Text>
          <Text style={styles.boxText}>{member.phone ?? 'No phone on file'}</Text>
          <Text style={styles.boxText}>{member.email ?? 'No email on file'}</Text>
          <Text style={styles.boxText}>{member.profession ?? 'No profession on file'}</Text>
          {member.date_of_birth ? <Text style={styles.boxText}>Born {formatDate(member.date_of_birth)}</Text> : null}
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Family</Text>
          {household ? (
            <>
              <Text style={styles.boxText}>{household.name ?? 'Unnamed family'}</Text>
              {[...familyMembers, ...familyDependents].length > 0 ? (
                <Text style={styles.boxSub}>
                  With {[...familyMembers.map((m) => m.full_name), ...familyDependents.map((d) => d.full_name)].join(', ')}
                </Text>
              ) : (
                <Text style={styles.boxSub}>No one else in this family yet.</Text>
              )}
            </>
          ) : (
            <Text style={styles.boxText}>Not part of a family yet.</Text>
          )}
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Sacraments</Text>
          <Text style={styles.boxText}>Baptism — {member.baptised ? baptismDetail ?? 'Granted' : member.pending_baptism ? 'Pending review' : 'Not yet'}</Text>
          {member.baptised ? (
            <Text style={styles.certLink} onPress={() => setCertKind('baptism')}>
              View Certificate
            </Text>
          ) : null}
          {member.baptised ? (
            <Text style={styles.certLink} onPress={() => setEditingBaptismCert(true)}>
              Edit Certificate Details
            </Text>
          ) : null}
          <Text style={styles.boxText}>
            Confirmation — {member.confirmed ? confirmationDetail ?? 'Granted' : member.pending_confirmation ? 'Pending review' : 'Not yet'}
          </Text>
          {member.confirmed ? (
            <Text style={styles.certLink} onPress={() => setCertKind('confirmation')}>
              View Certificate
            </Text>
          ) : null}
          {member.reviewed_at ? <Text style={styles.boxSub}>Last reviewed {formatDate(member.reviewed_at.slice(0, 10))}</Text> : null}
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitle}>League</Text>
          <View style={styles.chipsRow}>
            <Chip label={league ? league.label : 'No League / Organisation'} color={league?.color ?? colors.muted} />
          </View>
          {leagueAdminFor.length > 0 ? (
            <Text style={styles.boxSub}>Administers: {leagueAdminFor.map((l) => l.label).join(', ')}</Text>
          ) : null}
          {member.league_id && league ? (
            <Text style={styles.certLink} onPress={() => setCertKind('league')}>
              View Certificate
            </Text>
          ) : null}
        </View>

        {certKind ? (
          <CertificateModal
            visible
            onClose={() => setCertKind(null)}
            kind={certKind}
            subjectId={member.id}
            isDependent={false}
            name={member.full_name}
            application={certKind === 'baptism' ? member.baptism_application : certKind === 'confirmation' ? member.confirmation_application : member.league_application}
            reviewedAt={member.reviewed_at}
            league={certKind === 'league' ? league ?? null : null}
            dateOfBirth={member.date_of_birth}
          />
        ) : null}

        {editingBaptismCert ? (
          <BaptismCertificateDetailsModal
            targetId={member.id}
            isDependent={false}
            name={member.full_name}
            application={member.baptism_application}
            onClose={() => setEditingBaptismCert(false)}
            onSaved={() => {
              setEditingBaptismCert(false)
              onChanged()
              onClose()
            }}
          />
        ) : null}

        {certificates.length > 0 ? (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Certificates on file</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
              {certificates.map((c) => (
                <View key={c.label} style={{ alignItems: 'center' }}>
                  <Image source={{ uri: c.uri }} style={styles.certThumb} />
                  <Text style={styles.boxSub}>{c.label}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Activity</Text>
          <Text style={styles.boxText}>{daysActive === null ? 'Never logged in' : daysActive === 0 ? 'Active today' : `Active ${daysActive} day${daysActive === 1 ? '' : 's'} ago`}</Text>
          {member.self_reported_left_at ? <Text style={styles.boxSub}>Self-reported that they've left the parish.</Text> : null}
        </View>

        <View style={{ gap: 10, marginTop: 10 }}>
          <Button title="Edit" onPress={onEdit} />
          <Button title="Close" variant="secondary" onPress={onClose} />
        </View>
      </ScrollView>
    </Modal>
  )
}
