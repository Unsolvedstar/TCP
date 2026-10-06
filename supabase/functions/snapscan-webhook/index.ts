// Receives SnapScan's payment-status webhook and updates the matching
// snapscan_payments row (supabase/migrations/0025_snapscan_paygate.sql).
//
// Deploy: npx supabase functions deploy snapscan-webhook
// Then give SnapScan this function's URL
// (https://<project-ref>.functions.supabase.co/snapscan-webhook) as your
// webhook URL when they set it up.
//
// SIGNATURE VERIFICATION is REQUIRED (fail-closed). SnapScan signs each webhook
// POST (`Authorization: SnapScan signature=<HMAC-SHA256 hex of the raw body>` —
// see https://developer.snapscan.co.za/docs/webhooks). Get the key from SnapScan
// support, then `npx supabase secrets set SNAPSCAN_WEBHOOK_AUTH_KEY=...`. Every
// request must carry a matching signature or it is rejected with 401. If the
// secret is unset the function rejects everything with 503 rather than accept
// forgeable "payment completed" calls. For local testing only, set
// SNAPSCAN_WEBHOOK_ALLOW_UNSIGNED=true to bypass this.
//
// A payment that is already 'completed' is never changed by a later webhook.
//
// Per SnapScan's docs: they POST `application/x-www-form-urlencoded` with a
// single `payload` field containing a JSON string, only for completed/errored
// payments, and expect HTTP 200 back or they retry for up to 3 minutes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null
  return Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)))
}

// HMAC-SHA256 check via WebCrypto's verify(), which compares in constant time.
async function signatureIsValid(rawBody: string, authHeader: string | null, key: string): Promise<boolean> {
  const match = /signature=([0-9a-fA-F]+)/.exec(authHeader ?? '')
  const sig = match ? hexToBytes(match[1]) : null
  if (!sig) return false
  const cryptoKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', cryptoKey, sig, new TextEncoder().encode(rawBody))
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await req.text()

  const authKey = Deno.env.get('SNAPSCAN_WEBHOOK_AUTH_KEY')
  if (authKey) {
    if (!(await signatureIsValid(rawBody, req.headers.get('authorization'), authKey))) {
      console.error('SnapScan webhook: missing or invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }
  } else if (Deno.env.get('SNAPSCAN_WEBHOOK_ALLOW_UNSIGNED') !== 'true') {
    console.error('SnapScan webhook: SNAPSCAN_WEBHOOK_AUTH_KEY is not set; refusing unsigned requests')
    return new Response('Webhook not configured', { status: 503 })
  }

  let payload: Record<string, unknown>
  try {
    const form = new URLSearchParams(rawBody)
    payload = JSON.parse(form.get('payload') ?? '{}')
  } catch (err) {
    console.error('SnapScan webhook: could not parse payload', err)
    // 200 to stop retries — retrying an unparsable body won't fix it; logged
    // above for investigation.
    return new Response('OK', { status: 200 })
  }

  const merchantReference = typeof payload.merchantReference === 'string' ? payload.merchantReference : null
  const snapscanPaymentId = payload.id != null ? String(payload.id) : null
  const rawStatus = typeof payload.status === 'string' ? payload.status.toLowerCase() : ''
  const status = rawStatus === 'completed' ? 'completed' : 'error'

  if (!merchantReference) {
    console.error('SnapScan webhook: payload missing merchantReference', payload)
    return new Response('OK', { status: 200 })
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { error, count } = await supabase
    .from('snapscan_payments')
    .update({
      status,
      snapscan_payment_id: snapscanPaymentId,
      raw_webhook: payload,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    }, { count: 'exact' })
    .eq('merchant_reference', merchantReference)
    .neq('status', 'completed') // a finished payment is final

  if (error) {
    console.error('SnapScan webhook: failed to update payment', error)
    // Our own DB error, not SnapScan's problem — 200 anyway, since a retry
    // within the same 3-minute window is unlikely to help if this failed;
    // logged above for investigation.
    return new Response('OK', { status: 200 })
  }
  if (!count) {
    console.error('SnapScan webhook: no pending payment for merchant_reference (unknown, or already completed)', merchantReference)
  }

  return new Response('OK', { status: 200 })
})
