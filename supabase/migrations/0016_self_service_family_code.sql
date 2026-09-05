-- Self-service family codes for new-in-family registrants --------------------
-- Until now every household code came from an admin batch (0014) — even the
-- very first person in a brand-new family needed one handed to them ahead of
-- time. The landing page's "become a member" flow now asks up front whether
-- someone already has family registered here; anyone who says no gets a
-- fresh code minted on the spot, the same moment they choose to register,
-- rather than needing an office visit first. Admin-minted batches
-- (admin_generate_household_codes, 0014) still work unchanged, for
-- congregations that want to keep pre-printing physical code cards.

create or replace function public.start_new_family(p_congregation_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  new_code text;
begin
  if p_congregation_id is null or not exists (select 1 from public.congregations where id = p_congregation_id) then
    raise exception 'Invalid or missing congregation.';
  end if;
  loop
    new_code := public.generate_household_code();
    begin
      insert into public.households (congregation_id, code) values (p_congregation_id, new_code);
      exit;
    exception when unique_violation then
      -- code collision — try another
    end;
  end loop;
  return new_code;
end;
$$;

-- Granted to anon (not just authenticated): this runs from the registration
-- screen before the person has an account, same as check_family_code and the
-- pre-auth congregation lookups in 0001_init.sql section 4.
grant execute on function public.start_new_family(uuid) to anon, authenticated;
