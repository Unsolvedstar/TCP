-- create_snapscan_payment() (0027) returns table(id, merchant_reference), so the
-- bare `id` in its own lookups collided with that output column and every call
-- failed with: column reference "id" is ambiguous. Re-declared with the
-- columns table-qualified; behaviour is otherwise unchanged.

create or replace function public.create_snapscan_payment(p_amount_cents integer, p_payment_code_id uuid default null)
returns table(id uuid, merchant_reference text)
language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid; my_reference text; new_id uuid;
begin
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 10000000 then
    raise exception 'Invalid amount.';
  end if;
  select p.congregation_id into my_congregation_id from public.profiles p where p.id = auth.uid();
  if my_congregation_id is null then raise exception 'not authorized'; end if;

  if p_payment_code_id is not null and not exists (
    select 1 from public.congregation_payment_codes c where c.id = p_payment_code_id and c.congregation_id = my_congregation_id
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
