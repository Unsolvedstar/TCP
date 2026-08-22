/// <reference types="jest" />
import { classifyAge } from '../age-groups'

const NOW = new Date(2026, 7, 22) // 22 August 2026

describe('classifyAge', () => {
  it('returns null when the date of birth is unknown', () => {
    expect(classifyAge(null, NOW)).toBe(null)
  })

  it('classifies a young child', () => {
    expect(classifyAge('2018-01-01', NOW)).toBe('child')
  })

  it('classifies someone the day before their 18th birthday as still a child', () => {
    expect(classifyAge('2008-08-23', NOW)).toBe('child') // turns 18 tomorrow
  })

  it('classifies someone on their 18th birthday as an adult', () => {
    expect(classifyAge('2008-08-22', NOW)).toBe('adult')
  })

  it('classifies a middle-aged adult', () => {
    expect(classifyAge('1980-06-15', NOW)).toBe('adult')
  })

  it('classifies someone the day before their 60th birthday as still an adult', () => {
    expect(classifyAge('1966-08-23', NOW)).toBe('adult') // turns 60 tomorrow
  })

  it('classifies someone on their 60th birthday as an elder', () => {
    expect(classifyAge('1966-08-22', NOW)).toBe('elder')
  })

  it('classifies someone well past 60 as an elder', () => {
    expect(classifyAge('1940-03-01', NOW)).toBe('elder')
  })

  it('reclassifies automatically as time passes, from the same birthdate', () => {
    const seventeenYearOld = '2009-01-01'
    expect(classifyAge(seventeenYearOld, new Date(2026, 0, 1))).toBe('child')
    expect(classifyAge(seventeenYearOld, new Date(2027, 0, 1))).toBe('adult')
  })
})
