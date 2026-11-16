// Offline King James Version (1769 text, public domain; NIV is copyrighted so it's not used).
// Data lives in assets/bible/kjv.json, built by scripts/buildBible.mjs. Shape:
// { "Romans": [ ["ch1 v1", "ch1 v2", ...], ...chapters ], ... } — verse N is index N-1.

type BibleData = Record<string, string[][]>

// ~4 MB — required lazily on first lookup so it isn't parsed at app start-up.
let cache: BibleData | null = null
function bible(): BibleData {
  if (!cache) cache = require('../assets/bible/kjv.json') as BibleData
  return cache
}

export type ParsedReference = { book: string; chapter: number; start: number; end: number }

// Canonical names plus the abbreviations people actually type. Keys are normalized
// (lowercase, no dots/spaces) by normBook().
const ALIASES: Record<string, string> = {
  gen: 'Genesis', ge: 'Genesis', exo: 'Exodus', exod: 'Exodus', ex: 'Exodus', lev: 'Leviticus', le: 'Leviticus',
  num: 'Numbers', nu: 'Numbers', deut: 'Deuteronomy', deu: 'Deuteronomy', dt: 'Deuteronomy', josh: 'Joshua', jos: 'Joshua',
  judg: 'Judges', jdg: 'Judges', rut: 'Ruth', ru: 'Ruth',
  '1sam': '1 Samuel', '1sa': '1 Samuel', '2sam': '2 Samuel', '2sa': '2 Samuel',
  '1kgs': '1 Kings', '1ki': '1 Kings', '1kings': '1 Kings', '2kgs': '2 Kings', '2ki': '2 Kings', '2kings': '2 Kings',
  '1chron': '1 Chronicles', '1chr': '1 Chronicles', '1ch': '1 Chronicles', '2chron': '2 Chronicles', '2chr': '2 Chronicles', '2ch': '2 Chronicles',
  ezr: 'Ezra', neh: 'Nehemiah', est: 'Esther', esth: 'Esther', psalm: 'Psalms', ps: 'Psalms', psa: 'Psalms', pslm: 'Psalms',
  prov: 'Proverbs', pro: 'Proverbs', prv: 'Proverbs', eccl: 'Ecclesiastes', ecc: 'Ecclesiastes', eccles: 'Ecclesiastes',
  songofsongs: 'Song of Solomon', songofsol: 'Song of Solomon', song: 'Song of Solomon', sos: 'Song of Solomon', canticles: 'Song of Solomon',
  isa: 'Isaiah', jer: 'Jeremiah', lam: 'Lamentations', ezek: 'Ezekiel', eze: 'Ezekiel', dan: 'Daniel', hos: 'Hosea',
  joe: 'Joel', amo: 'Amos', oba: 'Obadiah', obad: 'Obadiah', jon: 'Jonah', mic: 'Micah', nah: 'Nahum', hab: 'Habakkuk',
  zeph: 'Zephaniah', zep: 'Zephaniah', hag: 'Haggai', zech: 'Zechariah', zec: 'Zechariah', mal: 'Malachi',
  matt: 'Matthew', mat: 'Matthew', mt: 'Matthew', mrk: 'Mark', mk: 'Mark', luk: 'Luke', lk: 'Luke', joh: 'John', jhn: 'John', jn: 'John',
  act: 'Acts', rom: 'Romans', ro: 'Romans', rm: 'Romans',
  '1cor': '1 Corinthians', '1co': '1 Corinthians', '2cor': '2 Corinthians', '2co': '2 Corinthians',
  gal: 'Galatians', eph: 'Ephesians', phil: 'Philippians', php: 'Philippians', pp: 'Philippians', col: 'Colossians',
  '1thess': '1 Thessalonians', '1thes': '1 Thessalonians', '1th': '1 Thessalonians', '2thess': '2 Thessalonians', '2thes': '2 Thessalonians', '2th': '2 Thessalonians',
  '1tim': '1 Timothy', '1ti': '1 Timothy', '2tim': '2 Timothy', '2ti': '2 Timothy', tit: 'Titus', phlm: 'Philemon', philem: 'Philemon', phm: 'Philemon',
  heb: 'Hebrews', jas: 'James', jam: 'James', '1pet': '1 Peter', '1pe': '1 Peter', '1pt': '1 Peter', '2pet': '2 Peter', '2pe': '2 Peter', '2pt': '2 Peter',
  '1jn': '1 John', '1joh': '1 John', '1jo': '1 John', '2jn': '2 John', '2joh': '2 John', '2jo': '2 John', '3jn': '3 John', '3joh': '3 John', '3jo': '3 John',
  jud: 'Jude', rev: 'Revelation', revelations: 'Revelation', apocalypse: 'Revelation',
}

const normBook = (s: string) =>
  s
    .toLowerCase()
    .replace(/^(first|i)\s+/, '1 ')
    .replace(/^(second|ii)\s+/, '2 ')
    .replace(/^(third|iii)\s+/, '3 ')
    .replace(/[.\s]/g, '')

let canonicalByNorm: Map<string, string> | null = null
function resolveBook(raw: string): string | null {
  if (!canonicalByNorm) {
    canonicalByNorm = new Map(Object.keys(bible()).map((name) => [normBook(name), name]))
  }
  const key = normBook(raw)
  return canonicalByNorm.get(key) ?? (ALIASES[key] && canonicalByNorm.get(normBook(ALIASES[key]))) ?? null
}

/** Parses "Romans 12:2", "1 Cor 13:4-7", "Ps. 23:1" (a trailing translation tag like "KJV" is ignored). Needs a verse. */
export function parseReference(input: string): ParsedReference | null {
  const m = input.trim().replace(/\s+(kjv|web)$/i, '').match(/^(.+?)\s*(\d+)\s*:\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/)
  if (!m) return null
  const book = resolveBook(m[1])
  if (!book) return null
  const chapter = Number(m[2])
  const start = Number(m[3])
  const end = m[4] ? Number(m[4]) : start
  if (chapter < 1 || start < 1 || end < start) return null
  return { book, chapter, start, end }
}

export const formatReference = (r: ParsedReference) =>
  `${r.book} ${r.chapter}:${r.start}${r.end > r.start ? `-${r.end}` : ''}`

/** Verse text for a reference from the bundled Bible, or null if it can't be parsed or doesn't exist. */
export function lookupVerse(input: string): { reference: string; text: string } | null {
  const ref = parseReference(input)
  if (!ref) return null
  const chapter = bible()[ref.book]?.[ref.chapter - 1]
  if (!chapter || ref.start > chapter.length) return null
  const end = Math.min(ref.end, chapter.length)
  const text = chapter.slice(ref.start - 1, end).filter(Boolean).join(' ').trim()
  if (!text) return null
  return { reference: formatReference({ ...ref, end }), text }
}
