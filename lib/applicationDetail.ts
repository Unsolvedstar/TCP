import type { BaptismApplication, ConfirmationApplication, LeagueApplication } from './types'

export type ApplicationKind = 'league' | 'baptism' | 'confirmation'
export type AnyApplication = LeagueApplication | BaptismApplication | ConfirmationApplication

/** Human-readable summary of an application record, regardless of where it came from (registration or a portal request). */
export function applicationDetailText(type: ApplicationKind, application: AnyApplication | null | undefined): string | null {
  if (!application) return null
  const parts: (string | null | undefined)[] =
    type === 'league'
      ? [(application as LeagueApplication).reason ? `Reason: ${(application as LeagueApplication).reason}` : null]
      : type === 'baptism'
        ? [
            (application as BaptismApplication).type,
            (application as BaptismApplication).sponsor_name ? `Sponsor: ${(application as BaptismApplication).sponsor_name}` : null,
            (application as BaptismApplication).location ? `Where: ${(application as BaptismApplication).location}` : null,
            (application as BaptismApplication).officiant_name ? `Officiated by: ${(application as BaptismApplication).officiant_name}` : null,
            (application as BaptismApplication).note ? `Note: ${(application as BaptismApplication).note}` : null,
          ]
        : [
            (application as ConfirmationApplication).mentor_name ? `Mentor: ${(application as ConfirmationApplication).mentor_name}` : null,
            (application as ConfirmationApplication).location ? `Where: ${(application as ConfirmationApplication).location}` : null,
            (application as ConfirmationApplication).officiant_name ? `Officiated by: ${(application as ConfirmationApplication).officiant_name}` : null,
            (application as ConfirmationApplication).note ? `Note: ${(application as ConfirmationApplication).note}` : null,
          ]
  const text = parts.filter(Boolean).join(', ')
  return text || null
}

export function applicationCertificateList(application: AnyApplication | null | undefined): { label: string; uri: string }[] {
  if (!application) return []
  const out: { label: string; uri: string }[] = []
  const app = application as LeagueApplication & ConfirmationApplication
  if (app.baptism_certificate) out.push({ label: 'Baptism Cert.', uri: app.baptism_certificate })
  if (app.confirmation_certificate) out.push({ label: 'Confirmation Cert.', uri: app.confirmation_certificate })
  return out
}
