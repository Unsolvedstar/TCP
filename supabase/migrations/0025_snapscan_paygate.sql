-- SnapScan custom paygate: an in-app checkout with automatic, per-member
-- payment tracking. There is no QR code anywhere in this flow (deliberately
-- removed — see snapscan_qr_url in 0023_congregation_branding_banking.sql,
-- which is now unused dead schema, kept only because dropping it wasn't
-- asked for).
--
-- How it works (see supabase/functions/snapscan-webhook/ and
-- app/(app)/bankingSnapscan.tsx):
--   1. Member enters an amount and taps "Pay with SnapScan". The app calls
--      create_snapscan_payment() below, which inserts a 'pending' row and
--      hands back a merchant_reference.
--   2. The app opens SnapScan's payment URL
--      (https://pos.snapscan.io/qr/{merchant_code}?id={merchant_reference}&amount=...),
--      which deep-links straight into the SnapScan app to confirm — no QR
--      shown. See https://developer.snapscan.co.za/docs/creating-a-url.
--   3. SnapScan POSTs a webhook when the payment completes or errors
--      (https://developer.snapscan.co.za/docs/webhooks) to the Edge
--      Function, which updates the row to 'completed'/'error' using the
--      service role (the only way this table is ever written to besides the
--      create RPC — see RLS below).
--
-- ⚠️ By explicit request, the Edge Function does NOT verify SnapScan's
-- webhook signature — see the warning comment at the top of
-- supabase/functions/snapscan-webhook/index.ts for what that means in
-- practice (anyone who finds the webhook URL can mark any payment
-- "completed" without real money moving) and how to add it back.
--
-- Needs, once a real SnapScan merchant account exists (none yet as of this
-- migration — see NOTES.md): the merchant code set via
-- admin_set_snapscan_merchant_code (Congregation Settings).

alter table public.congregations add column if not exists snapscan_merchant_code text;

create table if not exists public.snapscan_payments (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- Our own id, sent to SnapScan as `id=` and echoed back as
  -- `merchantReference` in the webhook payload — this is what matches a
  -- webhook back to a row, not SnapScan's own payment id (snapscan_payment_id
  -- below), which we don't know until the webhook arrives.
  merchant_reference text not null unique,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'completed', 'error')),
  snapscan_payment_id text,
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists snapscan_payments_profile_idx on public.snapscan_payments(profile_id);
create index if not exists snapscan_payments_congregation_idx on public.snapscan_payments(congregation_id);

alter table public.snapscan_payments enable row level security;

-- Same shape as "profiles: select" (0001_init.sql): a member sees their own
-- payments, an admin sees every payment in their own congregation (the
-- in-app replacement for the manual weekly offering summary). Nobody ever
-- gets insert/update/delete here directly — rows are only ever created by
-- create_snapscan_payment() and only ever updated by the webhook Edge
-- Function, both of which run as service_role/security definer.
drop policy if exists "snapscan_payments: select" on public.snapscan_payments;
create policy "snapscan_payments: select" on public.snapscan_payments
  for select using (profile_id = auth.uid() or public.is_admin_of(congregation_id));

grant select on public.snapscan_payments to authenticated;
grant all on public.snapscan_payments to service_role;

-- Member-facing: start a payment. Derives congregation/profile from
-- auth.uid() (never client-supplied, same as admin_create_ward etc.) so a
-- payment can never be forged onto someone else's account or another
-- congregation. amount_cents is capped, not just floor-checked, as a basic
-- fat-finger/fraud guard — R100,000 is comfortably above any single
-- legitimate offering/pledge tap; raise it in a follow-up migration if a
-- real congregation ever needs more.
create or replace function public.create_snapscan_payment(p_amount_cents integer)
returns table(id uuid, merchant_reference text)
language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid; my_reference text; new_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 10000000 then
    raise exception 'Invalid amount.';
  end if;
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if my_congregation_id is null then raise exception 'not authorized'; end if;

  my_reference := 'ELCSA-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  insert into public.snapscan_payments (congregation_id, profile_id, merchant_reference, amount_cents)
  values (my_congregation_id, auth.uid(), my_reference, p_amount_cents)
  returning snapscan_payments.id into new_id;

  return query select new_id, my_reference;
end;
$$;

grant execute on function public.create_snapscan_payment(integer) to authenticated;

-- Admin-facing: same pattern as admin_set_snapscan_qr (0024) — one plain
-- setter, no validation beyond authorization since a merchant code is an
-- opaque string SnapScan itself assigns.
create or replace function public.admin_set_snapscan_merchant_code(p_code text)
returns void language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid;
begin
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if not public.is_admin_of(my_congregation_id) then raise exception 'not authorized'; end if;
  update public.congregations set snapscan_merchant_code = p_code where id = my_congregation_id;
end;
$$;

grant execute on function public.admin_set_snapscan_merchant_code(text) to authenticated;
