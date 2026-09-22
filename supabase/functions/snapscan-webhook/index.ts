// Receives SnapScan's payment-status webhook and updates the matching
// snapscan_payments row (supabase/migrations/0025_snapscan_paygate.sql).
//
// Deploy: npx supabase functions deploy snapscan-webhook
// Then give SnapScan this function's URL
// (https://<project-ref>.functions.supabase.co/snapscan-webhook) as your
// webhook URL when they set it up.
//
// ⚠️ SIGNATURE VERIFICATION IS DELIBERATELY NOT IMPLEMENTED HERE (by
// explicit request). SnapScan signs each webhook POST
// (`Authorization: SnapScan signature=<HMAC-SHA256 of the raw body>` — see
// https://developer.snapscan.co.za/docs/webhooks) so a real merchant
// integration can verify it actually came from SnapScan. Without that check,
// anyone who discovers this function's URL can POST a fabricated
// `{"status":"completed", "merchantReference": "..."}` payload and mark any
// pending SnapScan payment as paid — including someone else's — without any
// money having moved. If that risk becomes unacceptable, reintroduce the
// check: require a Supabase secret (`SNAPSCAN_WEBHOOK_AUTH_KEY`, from
// SnapScan support), compute an HMAC-SHA256 hex digest of the raw request
// body with it, and reject the request unless it constant-time-matches the
// `signature=` value in the Authorization header.
//
// Per SnapScan's docs: they POST `application/x-www-form-urlencoded` with a
// single `payload` field containing a JSON string, only for completed/errored
// payments, and expect HTTP 200 back or they retry for up to 3 minutes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await req.text()

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

  if (error) {
    console.error('SnapScan webhook: failed to update payment', error)
    // Our own DB error, not SnapScan's problem — 200 anyway, since a retry
    // within the same 3-minute window is unlikely to help if this failed;
    // logged above for investigation.
    return new Response('OK', { status: 200 })
  }
  if (!count) {
    console.error('SnapScan webhook: no payment found for merchant_reference', merchantReference)
  }

  return new Response('OK', { status: 200 })
})
