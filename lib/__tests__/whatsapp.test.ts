import { toWhatsAppNumber, whatsAppUrl } from '../whatsapp'

describe('toWhatsAppNumber', () => {
  it('converts local South African numbers', () => {
    expect(toWhatsAppNumber('082 123 4567')).toBe('27821234567')
    expect(toWhatsAppNumber('0821234567')).toBe('27821234567')
    expect(toWhatsAppNumber('(012) 345-6789')).toBe('27123456789')
  })
  it('keeps international numbers', () => {
    expect(toWhatsAppNumber('+27 82 123 4567')).toBe('27821234567')
    expect(toWhatsAppNumber('0027821234567')).toBe('27821234567')
    expect(toWhatsAppNumber('+44 7911 123456')).toBe('447911123456')
  })
  it('rejects missing or unusable numbers', () => {
    expect(toWhatsAppNumber(null)).toBeNull()
    expect(toWhatsAppNumber('')).toBeNull()
    expect(toWhatsAppNumber('abc')).toBeNull()
    expect(toWhatsAppNumber('12345')).toBeNull()
    expect(toWhatsAppNumber('+1234567890123456')).toBeNull()
  })
})

describe('whatsAppUrl', () => {
  it('builds a wa.me link, with an optional encoded message', () => {
    expect(whatsAppUrl('082 123 4567')).toBe('https://wa.me/27821234567')
    expect(whatsAppUrl('082 123 4567', 'Hi there & welcome')).toBe('https://wa.me/27821234567?text=Hi%20there%20%26%20welcome')
    expect(whatsAppUrl('nope')).toBeNull()
  })
})
