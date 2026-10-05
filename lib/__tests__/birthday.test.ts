import { birthdayShownKey, firstName, isBirthdayToday, turningAge } from '../birthday'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12)

describe('isBirthdayToday', () => {
  it('matches on month and day regardless of birth year', () => {
    expect(isBirthdayToday('1990-10-05', d(2026, 10, 5))).toBe(true)
    expect(isBirthdayToday('2015-10-05', d(2026, 10, 5))).toBe(true)
  })
  it('does not match other days', () => {
    expect(isBirthdayToday('1990-10-05', d(2026, 10, 4))).toBe(false)
    expect(isBirthdayToday('1990-10-05', d(2026, 11, 5))).toBe(false)
  })
  it('handles missing or malformed dates', () => {
    expect(isBirthdayToday(null, d(2026, 10, 5))).toBe(false)
    expect(isBirthdayToday('', d(2026, 10, 5))).toBe(false)
    expect(isBirthdayToday('05/10/1990', d(2026, 10, 5))).toBe(false)
  })
  it('celebrates 29 February on 28 February in non-leap years only', () => {
    expect(isBirthdayToday('1992-02-29', d(2026, 2, 28))).toBe(true)
    expect(isBirthdayToday('1992-02-29', d(2028, 2, 28))).toBe(false)
    expect(isBirthdayToday('1992-02-29', d(2028, 2, 29))).toBe(true)
    expect(isBirthdayToday('1992-02-29', d(2026, 3, 1))).toBe(false)
  })
})

describe('turningAge', () => {
  it('returns the age being reached', () => {
    expect(turningAge('1990-10-05', d(2026, 10, 5))).toBe(36)
  })
  it('returns null for implausible years', () => {
    expect(turningAge('2026-10-05', d(2026, 10, 5))).toBeNull()
    expect(turningAge('1800-10-05', d(2026, 10, 5))).toBeNull()
  })
})

describe('helpers', () => {
  it('keys once per person per local day', () => {
    expect(birthdayShownKey('abc', d(2026, 10, 5))).toBe('birthday-shown:abc:2026-10-05')
  })
  it('extracts a first name', () => {
    expect(firstName('Tshedza Tshikovhi')).toBe('Tshedza')
    expect(firstName('  ')).toBe('')
    expect(firstName(null)).toBe('')
  })
})
