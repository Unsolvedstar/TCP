// Pure logic for the SnapScan checkout (paygate) flow — kept separate from
// app/(app)/bankingSnapscan.tsx so it's unit-testable without rendering
// anything, same convention as lib/dates.ts / lib/ageGroups.ts. See
// supabase/migrations/0025_snapscan_paygate.sql for the server side.

// Parses a Rand amount typed by a member (e.g. "150", "150.50", "R150") into
// integer cents for create_snapscan_payment/the SnapScan URL, which both
// work in cents. Returns null for anything that isn't a positive amount —
// callers show their own "enter a valid amount" message rather than this
// throwing, since it runs on every keystroke-adjacent validation, not just
// final submit.
export function randsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^R\s*/i, '').replace(/,/g, '')
  if (!cleaned || !/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const cents = Math.round(parseFloat(cleaned) * 100)
  return cents > 0 ? cents : null
}

export function centsToRandsDisplay(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`
}

// Builds the SnapScan payment URL per
// https://developer.snapscan.co.za/docs/creating-a-url — opening this
// directly (rather than scanning it as a QR) is what deep-links straight
// into the SnapScan app to confirm the exact amount. `strict` blocks
// duplicate/underpaid confirmations against the same reference.
export function buildSnapscanPaymentUrl(args: {
  merchantCode: string
  merchantReference: string
  amountCents: number
  successUrl?: string
  failureUrl?: string
}): string {
  const { merchantCode, merchantReference, amountCents, successUrl, failureUrl } = args
  const params = new URLSearchParams({
    id: merchantReference,
    amount: String(amountCents),
    strict: 'true',
  })
  if (successUrl) params.set('s_url', successUrl)
  if (failureUrl) params.set('f_url', failureUrl)
  return `https://pos.snapscan.io/qr/${encodeURIComponent(merchantCode)}?${params.toString()}`
}
