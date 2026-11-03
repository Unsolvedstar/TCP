/// <reference types="jest" />
import { familyCodeProblem, normalizeFamilyCode } from '../familyCode'

describe('normalizeFamilyCode', () => {
  it('upper-cases and removes spaces', () => {
    expect(normalizeFamilyCode(' mok oena 7 ')).toBe('MOKOENA7')
  })
})

describe('familyCodeProblem', () => {
  it('accepts 6 to 12 letters or numbers', () => {
    expect(familyCodeProblem('ABC123')).toBeNull()
    expect(familyCodeProblem('mokoena2026')).toBeNull()
    expect(familyCodeProblem('ABCDEFGHIJKL')).toBeNull()
  })

  it('rejects codes that are too short or too long', () => {
    expect(familyCodeProblem('AB12')).toMatch(/at least 6/)
    expect(familyCodeProblem('ABCDEFGHIJKLM')).toMatch(/12/)
  })

  it('rejects symbols', () => {
    expect(familyCodeProblem('MOKOENA-1')).toMatch(/letters and numbers/)
    expect(familyCodeProblem('FAMILY!!')).toMatch(/letters and numbers/)
  })
})
