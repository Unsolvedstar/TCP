-- Fix: "Search by name" -> Confirm failed with "Could not find that person in
-- your congregation." whenever the picked relative had no family (household_id
-- null — e.g. an admin removed them from their family, or an older account).
-- search_possible_relatives happily lists those people, but join_sibling_family
-- treated a null household the same as "wrong congregation".
--
-- Now: a genuinely missing / other-congregation profile still errors, but a
-- relative with no family gets one created on the spot (named after them, with
-- a fresh code) and both people end up in it.

create or replace function public.join_sibling_family(p_sibling_profile_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  my_congregation_id uuid;
  my_full_name text;
  target_full_name text;
  target_household_id uuid;
  target_congregation_id uuid;
  target_found boolean;
  v_new_code text;
begin
  select congregation_id, full_name into my_congregation_id, my_full_name
  from public.profiles where id = auth.uid();

  select household_id, congregation_id, full_name, true
  into target_household_id, target_congregation_id, target_full_name, target_found
  from public.profiles where id = p_sibling_profile_id;

  if target_found is not true or target_congregation_id is distinct from my_congregation_id then
    raise exception 'Could not find that person in your congregation.';
  end if;

  if target_household_id is null then
    loop
      v_new_code := public.generate_household_code();
      begin
        insert into public.households (congregation_id, code, name, created_by)
        values (my_congregation_id, v_new_code, public.derive_family_name(target_full_name), auth.uid())
        returning id into target_household_id;
        exit;
      exception when unique_violation then
        -- code collision — try another
      end;
    end loop;
    update public.profiles set household_id = target_household_id where id = p_sibling_profile_id;
    update public.dependents set household_id = target_household_id where guardian_id = p_sibling_profile_id;
  end if;

  update public.profiles set household_id = target_household_id where id = auth.uid();
  update public.dependents set household_id = target_household_id where guardian_id = auth.uid();

  insert into public.household_auto_merges (household_id, profile_id, matched_surname, match_type)
  values (target_household_id, auth.uid(), public.derive_surname(my_full_name), 'self_selected');

  return target_household_id;
end;
$$;

grant execute on function public.join_sibling_family(uuid) to authenticated;
