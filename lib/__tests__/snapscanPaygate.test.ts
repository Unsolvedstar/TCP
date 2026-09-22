/// <reference types="jest" />
import { randsToCents, centsToRandsDisplay, buildSnapscanPaymentUrl } from '../snapscanPaygate'

describe('randsToCents', () => {
  it('parses a whole-Rand amount', () => {
    expect(randsToCents('150')).toBe(15000)
  })

  it('parses cents', () => {
    expect(randsToCents('150.50')).toBe(15050)
  })

  it('strips a leading "R" and thousands separators', () => {
    expect(randsToCents('R1,250.00')).toBe(125000)
  })

  it('rounds a single decimal digit as tenths of a Rand', () => {
    expect(randsToCents('10.5')).toBe(1050)
  })

  it('rejects zero, negative, empty, and non-numeric input', () => {
    expect(randsToCents('0')).toBeNull()
    expect(randsToCents('-5')).toBeNull()
    expect(randsToCents('')).toBeNull()
    expect(randsToCents('   ')).toBeNull()
    expect(randsToCents('abc')).toBeNull()
  })

  it('rejects more than two decimal places', () => {
    expect(randsToCents('10.123')).toBeNull()
  })
})

describe('centsToRandsDisplay', () => {
  it('formats cents as a Rand string with two decimals', () => {
    expect(centsToRandsDisplay(15050)).toBe('R150.50')
  })

  it('pads a round amount to two decimals', () => {
    expect(centsToRandsDisplay(10000)).toBe('R100.00')
  })
})

describe('buildSnapscanPaymentUrl', () => {
  it('builds the base pos.snapscan.io URL with id, amount, and strict mode', () => {
    const url = buildSnapscanPaymentUrl({ merchantCode: 'ourchurch', merchantReference: 'ELCSA-abc123', amountCents: 15000 })
    expect(url).toBe('https://pos.snapscan.io/qr/ourchurch?id=ELCSA-abc123&amount=15000&strict=true')
  })

  it('includes success/failure redirect URLs when given', () => {
    const url = buildSnapscanPaymentUrl({
      merchantCode: 'ourchurch',
      merchantReference: 'ELCSA-abc123',
      amountCents: 15000,
      successUrl: 'elcsatcp://bankingSnapscan?ref=ELCSA-abc123',
      failureUrl: 'elcsatcp://bankingSnapscan?ref=ELCSA-abc123&failed=1',
    })
    expect(url).toContain(`s_url=${encodeURIComponent('elcsatcp://bankingSnapscan?ref=ELCSA-abc123')}`)
    expect(url).toContain(`f_url=${encodeURIComponent('elcsatcp://bankingSnapscan?ref=ELCSA-abc123&failed=1')}`)
  })

  it('URL-encodes a merchant code with special characters', () => {
    const url = buildSnapscanPaymentUrl({ merchantCode: 'our church', merchantReference: 'REF1', amountCents: 100 })
    expect(url.startsWith('https://pos.snapscan.io/qr/our%20church?')).toBe(true)
  })
})
