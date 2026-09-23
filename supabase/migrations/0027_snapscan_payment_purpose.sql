-- Let a SnapScan payment reference what it's for, same as EFT already can --
-- EFT giving has always had `congregation_payment_codes` (Tithe, Sunday
-- Offering, Building Project, etc. — 0023) that a member appends to their
-- bank reference. SnapScan checkout (0025) never had an equivalent: it only
-- ever took a bare amount, so there was no way to tell what a given SnapScan
-- payment was actually for. This adds an optional purpose picker backed by
-- the same payment codes table — optional (not required) since a member
-- should still be able to just give without picking a category.

alter table public.snapscan_payments add column if not exists payment_code_id uuid references public.congregation_payment_codes(id);

-- Re-declared from 0025, adding the new optional parameter. Dropped first —
-- a new parameter changes the function's signature, so `create or replace`
-- would just add a second overload instead of replacing it, leaving the old
-- one-argument version callable too. Validates the chosen code actually
-- belongs to the caller's own congregation — same "never trust a
-- client-supplied foreign key across tenants" posture as the rest of the
-- multi-congregation RPCs.
drop function if exists public.create_snapscan_payment(integer);

create or replace function public.create_snapscan_payment(p_amount_cents integer, p_payment_code_id uuid default null)
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

  if p_payment_code_id is not null and not exists (
    select 1 from public.congregation_payment_codes where id = p_payment_code_id and congregation_id = my_congregation_id
  ) then
    raise exception 'Invalid payment code.';
  end if;

  my_reference := 'ELCSA-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  insert into public.snapscan_payments (congregation_id, profile_id, merchant_reference, amount_cents, payment_code_id)
  values (my_congregation_id, auth.uid(), my_reference, p_amount_cents, p_payment_code_id)
  returning snapscan_payments.id into new_id;

  return query select new_id, my_reference;
end;
$$;

grant execute on function public.create_snapscan_payment(integer, uuid) to authenticated;
