import { DEFAULT_VERSE_REFERENCES, defaultVerse, resolveVerse } from '../certificateVerse'
import type { CeremonyKind } from '../types'

const KINDS: CeremonyKind[] = ['baptism', 'confirmation', 'league']

describe('resolveVerse', () => {
  it.each(KINDS)('always returns a verse with text and a reference for %s, even with nothing set', (kind) => {
    for (const custom of [undefined, null, {}, { text: null, reference: null }, { text: '', reference: '' }, { text: '   ', reference: 'John 3:16' }]) {
      const v = resolveVerse(kind, custom)
      expect(v.text.length).toBeGreaterThan(10)
      expect(v.reference.length).toBeGreaterThan(3)
    }
  })

  it('uses the admin-entered verse when there is text, trimmed', () => {
    expect(resolveVerse('league', { text: '  Do not conform.  ', reference: ' Romans 12:2 NIV ' })).toEqual({ text: 'Do not conform.', reference: 'Romans 12:2 NIV' })
  })

  it('keeps a custom verse that has no reference rather than substituting a default', () => {
    expect(resolveVerse('baptism', { text: 'Some verse', reference: null })).toEqual({ text: 'Some verse', reference: '' })
  })

  it('ignores a lone reference with no text', () => {
    expect(resolveVerse('baptism', { text: null, reference: 'John 3:16' })).toEqual(defaultVerse('baptism'))
  })
})

describe('default verse pools', () => {
  it.each(KINDS)('every %s pool entry resolves to real text in the bundled Bible', (kind) => {
    expect(DEFAULT_VERSE_REFERENCES[kind].length).toBeGreaterThanOrEqual(15)
    for (const ref of DEFAULT_VERSE_REFERENCES[kind]) {
      const v = defaultVerse(kind, 'x')
      expect(v.text.length).toBeGreaterThan(10)
      // Direct check of the entry itself, not just whichever one the seed picked:
      const { lookupVerse } = require('../bibleText')
      expect(lookupVerse(ref)?.text.length).toBeGreaterThan(10)
    }
  })

  it('is stable for the same seed and varies across seeds', () => {
    expect(defaultVerse('baptism', 'Anna|2026-01-01')).toEqual(defaultVerse('baptism', 'Anna|2026-01-01'))
    const seen = new Set(Array.from({ length: 60 }, (_, i) => defaultVerse('baptism', `person ${i}`).reference))
    expect(seen.size).toBeGreaterThan(5)
  })

  it('labels defaults with the KJV translation', () => {
    expect(defaultVerse('league', 'a').reference).toMatch(/ KJV$/)
  })
})
