import type { CeremonyKind } from './types'

export type CertificateVerse = { text: string; reference: string }

// Every certificate carries a Bible verse. Admins can set a specific one (per
// baptism, or per league); when they haven't, these are used so the line is
// never blank. World English Bible — public domain, same translation as the
// verse lookup in lib/bibleVerse.ts (NIV is copyrighted, so it's not used).
export const DEFAULT_VERSES: Record<CeremonyKind, CertificateVerse> = {
  baptism: {
    text: 'For as many of you as were baptized into Christ have put on Christ.',
    reference: 'Galatians 3:27 WEB',
  },
  confirmation: {
    text: 'being confident of this very thing, that he who began a good work in you will complete it until the day of Jesus Christ.',
    reference: 'Philippians 1:6 WEB',
  },
  league: {
    text: 'As each has received a gift, employ it in serving one another, as good managers of the grace of God in its various forms.',
    reference: '1 Peter 4:10 WEB',
  },
}

/**
 * The verse to print: the admin's own when they've entered text, otherwise the
 * default for this kind of certificate. A reference on its own (no text) is
 * ignored — a verse reference with no verse is worse than the default.
 */
export function resolveVerse(kind: CeremonyKind, custom?: { text?: string | null; reference?: string | null } | null): CertificateVerse {
  const text = custom?.text?.trim()
  if (!text) return DEFAULT_VERSES[kind]
  return { text, reference: custom?.reference?.trim() ?? '' }
}
