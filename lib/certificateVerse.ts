import type { CeremonyKind } from './types'
import { lookupVerse } from './bibleText'

export type CertificateVerse = { text: string; reference: string }

// Every certificate carries a Bible verse. Admins can set a specific one (per
// baptism, or per league); when they haven't, one is chosen from the curated
// pool for that kind of certificate so the line is never blank. Texts come from
// the bundled King James Version (lib/bibleText.ts) — public domain, same
// translation as the verse lookup in lib/bibleVerse.ts (NIV is copyrighted).
export const DEFAULT_VERSE_REFERENCES: Record<CeremonyKind, string[]> = {
  baptism: [
    'Galatians 3:27', 'Romans 6:4', 'Romans 6:3', 'Matthew 28:19', 'Mark 16:16', 'Acts 2:38', 'Acts 22:16',
    'Colossians 2:12', '1 Peter 3:21', 'Titus 3:5', 'John 3:5', 'Ephesians 4:5', '2 Corinthians 5:17',
    'Galatians 2:20', 'John 3:16', 'Isaiah 43:1', 'Psalm 139:14', 'Matthew 19:14',
  ],
  confirmation: [
    'Philippians 1:6', 'Joshua 1:9', 'Proverbs 3:5-6', 'Jeremiah 29:11', 'Isaiah 41:10', '2 Timothy 1:7',
    'Romans 12:2', 'Psalm 119:105', 'Philippians 4:13', 'Ephesians 2:8-9', 'Hebrews 11:1', '1 Timothy 4:12',
    'Matthew 5:16', 'Psalm 121:1-2', 'John 14:6', 'Romans 8:28', 'Micah 6:8', 'Joshua 24:15', '1 Corinthians 16:13',
  ],
  league: [
    '1 Peter 4:10', 'Galatians 5:13', 'Colossians 3:23', 'Romans 12:6', 'Hebrews 6:10', 'Mark 10:45',
    '1 Corinthians 15:58', 'Galatians 6:9', 'Romans 12:10', 'Philippians 2:3-4', 'John 13:34', '1 John 3:18',
    'Matthew 25:40', 'Hebrews 10:24', 'Psalm 133:1', 'Ecclesiastes 4:9', 'Proverbs 27:17', 'Ephesians 4:16',
  ],
}

/** Small stable string hash (FNV-1a) — same seed always gives the same index. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * The default verse for a certificate. `seed` (e.g. the person's name + date)
 * picks from the pool deterministically, so different certificates get
 * different verses but reprinting one always gives the same verse.
 */
export function defaultVerse(kind: CeremonyKind, seed = ''): CertificateVerse {
  const pool = DEFAULT_VERSE_REFERENCES[kind]
  const found = lookupVerse(pool[hash(`${kind}|${seed}`) % pool.length])
  // Pool entries are verified by tests; fall back to the first one rather than ever printing nothing.
  const v = found ?? lookupVerse(pool[0])!
  return { text: v.text, reference: `${v.reference} KJV` }
}

/**
 * The verse to print: the admin's own when they've entered text, otherwise a
 * default from this kind's pool. A reference on its own (no text) is ignored —
 * a verse reference with no verse is worse than a default.
 */
export function resolveVerse(
  kind: CeremonyKind,
  custom?: { text?: string | null; reference?: string | null } | null,
  seed?: string,
): CertificateVerse {
  const text = custom?.text?.trim()
  if (!text) return defaultVerse(kind, seed)
  return { text, reference: custom?.reference?.trim() ?? '' }
}
