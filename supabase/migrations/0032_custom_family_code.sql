-- Families can choose their own code ---------------------------------------
-- Until now a family code was always generated (6 random characters). Anyone in
-- a family can now replace it with one they will actually remember, so everyone
-- in the family can share it: 6 to 12 letters or numbers, unique across the
-- app (the column already has a unique constraint, 0014). The old code stops
-- working at once; people already in the family are unaffected.
--
-- Only someone who is *in* the household can change its code, and only their
-- own household's. Admins keep admin_regenerate_household_code (0014).

create or replace function public.set_family_code(p_code text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  my_household_id uuid;
  new_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
begin
  select household_id into my_household_id from public.profiles where id = auth.uid();
  if my_household_id is null then
    raise exception 'You are not part of a family yet.';
  end if;

  if new_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'A family code must be 6 to 12 letters or numbers, with no spaces or symbols.';
  end if;

  begin
    update public.households set code = new_code where id = my_household_id;
  exception when unique_violation then
    raise exception 'That code is already taken. Please choose another.';
  end;

  return new_code;
end;
$$;

grant execute on function public.set_family_code(text) to authenticated;
