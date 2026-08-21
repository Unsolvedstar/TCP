/// <reference types="jest" />
import { getLiturgicalSeason } from '../liturgical-theme'
import { liturgicalPalette } from '../../theme'

// All boundary dates below are derived from Easter Sunday 2026 = 5 April 2026
// (Ash Wed = Easter-46, Palm Sunday = Easter-7, Maundy Thu = Easter-3,
// Good Friday = Easter-2, Pentecost = Easter+49) and Advent Sunday 2026 =
// 29 November 2026 (Sunday nearest 30 Nov) — same reference points as
// church-calendar.test.ts.
describe('getLiturgicalSeason', () => {
  it('is ordinary time in mid-January (Epiphany season)', () => {
    const s = getLiturgicalSeason(new Date(2026, 0, 15))
    expect(s.name).toBe('Season after Pentecost')
    expect(s.color).toBe(liturgicalPalette.ordinary.color)
  })

  it('is Lent on Ash Wednesday', () => {
    const s = getLiturgicalSeason(new Date(2026, 1, 18))
    expect(s.name).toBe('Lent')
    expect(s.color).toBe(liturgicalPalette.lent.color)
  })

  it('is Holy Week on Palm Sunday', () => {
    const s = getLiturgicalSeason(new Date(2026, 2, 29))
    expect(s.name).toBe('Holy Week')
  })

  it('is Maundy Thursday exactly', () => {
    const s = getLiturgicalSeason(new Date(2026, 3, 2))
    expect(s.name).toBe('Maundy Thursday')
    expect(s.color).toBe(liturgicalPalette.maundyThursday.color)
  })

  it('is Good Friday exactly', () => {
    const s = getLiturgicalSeason(new Date(2026, 3, 3))
    expect(s.name).toBe('Good Friday')
    expect(s.color).toBe(liturgicalPalette.goodFriday.color)
  })

  it('is Eastertide on Easter Sunday', () => {
    const s = getLiturgicalSeason(new Date(2026, 3, 5))
    expect(s.name).toBe('Eastertide')
    expect(s.color).toBe(liturgicalPalette.eastertide.color)
  })

  it('is Pentecost exactly', () => {
    const s = getLiturgicalSeason(new Date(2026, 4, 24))
    expect(s.name).toBe('Pentecost')
    expect(s.color).toBe(liturgicalPalette.pentecost.color)
  })

  it('is Reformation Day on 31 October', () => {
    const s = getLiturgicalSeason(new Date(2026, 9, 31))
    expect(s.name).toBe('Reformation Day')
  })

  it("is All Saints' Day on 1 November", () => {
    const s = getLiturgicalSeason(new Date(2026, 10, 1))
    expect(s.name).toBe("All Saints' Day")
  })

  it('is Advent on Advent Sunday', () => {
    const s = getLiturgicalSeason(new Date(2026, 10, 29))
    expect(s.name).toBe('Advent')
    expect(s.color).toBe(liturgicalPalette.advent.color)
  })

  it('is Christmastide on Christmas Day and stays through 31 December', () => {
    expect(getLiturgicalSeason(new Date(2026, 11, 25)).name).toBe('Christmastide')
    expect(getLiturgicalSeason(new Date(2026, 11, 31)).name).toBe('Christmastide')
  })

  it('carries Christmastide into the next year through Twelfth Night', () => {
    const s = getLiturgicalSeason(new Date(2027, 0, 5))
    expect(s.name).toBe('Christmastide')
  })

  it('returns to ordinary time the day after Twelfth Night', () => {
    const s = getLiturgicalSeason(new Date(2027, 0, 6))
    expect(s.name).toBe('Season after Pentecost')
  })
})
