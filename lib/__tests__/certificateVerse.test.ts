import { DEFAULT_VERSES, resolveVerse } from '../certificateVerse'
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

  it('has a distinct default for each kind of certificate', () => {
    expect(new Set(KINDS.map((k) => DEFAULT_VERSES[k].reference)).size).toBe(3)
  })

  it('uses the admin-entered verse when there is text, trimmed', () => {
    expect(resolveVerse('league', { text: '  Do not conform.  ', reference: ' Romans 12:2 NIV ' })).toEqual({ text: 'Do not conform.', reference: 'Romans 12:2 NIV' })
  })

  it('keeps a custom verse that has no reference rather than substituting a default', () => {
    expect(resolveVerse('baptism', { text: 'Some verse', reference: null })).toEqual({ text: 'Some verse', reference: '' })
  })

  it('ignores a lone reference with no text', () => {
    expect(resolveVerse('baptism', { text: null, reference: 'John 3:16' })).toEqual(DEFAULT_VERSES.baptism)
  })
})
