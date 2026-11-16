import { lookupVerse, parseReference } from '../bibleText'

describe('parseReference', () => {
  it('parses plain, ranged and abbreviated references', () => {
    expect(parseReference('Romans 12:2')).toEqual({ book: 'Romans', chapter: 12, start: 2, end: 2 })
    expect(parseReference('1 Cor 13:4-7')).toEqual({ book: '1 Corinthians', chapter: 13, start: 4, end: 7 })
    expect(parseReference('Ps. 23:1')).toEqual({ book: 'Psalms', chapter: 23, start: 1, end: 1 })
    expect(parseReference('psalm 23:1 KJV')).toEqual({ book: 'Psalms', chapter: 23, start: 1, end: 1 })
    expect(parseReference('First John 1:9')).toEqual({ book: '1 John', chapter: 1, start: 9, end: 9 })
    expect(parseReference('Song of Songs 2:4')?.book).toBe('Song of Solomon')
  })

  it.each(['', 'Romans', 'Romans 12', 'Hezekiah 1:1', 'Romans 12:5-2', 'Romans 0:1'])('rejects %p', (s) => {
    expect(parseReference(s)).toBeNull()
  })
})

describe('lookupVerse', () => {
  it('returns KJV text with a normalized reference', () => {
    expect(lookupVerse('rom 12:2')).toEqual({
      reference: 'Romans 12:2',
      text: expect.stringContaining('And be not conformed to this world'),
    })
  })

  it('joins verse ranges into one passage', () => {
    const v = lookupVerse('John 3:16-17')!
    expect(v.reference).toBe('John 3:16-17')
    expect(v.text).toContain('For God so loved the world')
    expect(v.text).toContain('For God sent not his Son into the world to condemn the world')
  })

  it('clamps a range past the end of the chapter', () => {
    expect(lookupVerse('Jude 1:24-99')?.reference).toBe('Jude 1:24-25')
  })

  it('returns null for verses that do not exist', () => {
    expect(lookupVerse('Romans 12:99')).toBeNull()
    expect(lookupVerse('Romans 99:1')).toBeNull()
  })
})
