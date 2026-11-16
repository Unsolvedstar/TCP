import { lookupVerse } from './bibleText'

export type FetchedVerse = { reference: string; text: string }

/** Looks up a verse via bible-api.com's free, public-domain KJV (King James Version)
 * translation — deliberately not NIV, which is copyrighted by Biblica. Returns null on
 * any failure (bad reference, offline, non-200) rather than throwing, since this is an
 * optional lookup aid — the admin can always type the verse text by hand instead.
 *
 * Response shape (verified live 2026-09-08 with translation=web; same fields for kjv):
 * { reference: "Romans 12:2", verses: [...], text: "…\n", translation_id, translation_name, translation_note }
 */
export async function fetchVerse(reference: string): Promise<FetchedVerse | null> {
  const trimmed = reference.trim()
  if (!trimmed) return null
  // The whole KJV is bundled (lib/bibleText.ts), so most lookups work offline.
  // Only references it can't parse (e.g. a whole chapter) go to the network.
  const local = lookupVerse(trimmed)
  if (local) return local
  try {
    const res = await fetch(`https://bible-api.com/${encodeURIComponent(trimmed)}?translation=kjv`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.text) return null
    // API returns text with a trailing (and, for multi-verse ranges, embedded)
    // newline per verse; certificates want one flowing quote.
    const text = String(data.text).replace(/\s*\n+\s*/g, ' ').trim()
    const ref = String(data.reference ?? trimmed).trim()
    if (!text) return null
    return { reference: ref, text }
  } catch {
    return null
  }
}
