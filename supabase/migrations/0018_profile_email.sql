-- Surface each member's email to admins -------------------------------------
-- Email only ever lived in auth.users, which the client can't read directly
-- (no RLS-exposed view onto the auth schema) — the admin Registry had no way
-- to see it at all, unlike phone which has always been a plain profiles
-- column. Mirrored onto profiles at signup, same pattern phone already
-- uses, so it's just another RLS-scoped column instead of a cross-schema
-- lookup. This is a snapshot taken once at registration — there's no
-- "change your email" flow in this app yet, so there's nothing that could
-- make it drift from auth.users today.

alter table public.profiles add column if not exists email text;

-- Backfill everyone who registered before this column existed. Migrations
-- run with full database privileges, so this can read auth.users directly
-- even though no client-facing policy ever will.
update public.profiles p set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Re-declared in full from its latest form in 0017_auto_family_matching.sql
-- (same "re-declare, don't edit the old file" convention every migration
-- here uses) — the only change is capturing new.email onto the profiles row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  p_congregation_id uuid := nullif(new.raw_user_meta_data->>'congregation_id', '')::uuid;
  p_ward_id uuid := nullif(new.raw_user_meta_data->>'ward_id', '')::uuid;
  claims_league_id uuid := nullif(new.raw_user_meta_data->>'league_id', '')::uuid;
  claims_baptised boolean := coalesce((new.raw_user_meta_data->>'already_baptised')::boolean, false);
  claims_confirmed boolean := coalesce((new.raw_user_meta_data->>'already_confirmed')::boolean, false) and claims_baptised;
  p_family_code text := nullif(trim(new.raw_user_meta_data->>'family_code'), '');
  p_full_name text := coalesce(new.raw_user_meta_data->>'full_name', 'New Member');
  v_household_id uuid;
  v_household_name text;
  v_surname text;
  v_match_ids uuid[];
  v_auto_merged boolean := false;
  v_new_code text;
begin
  if p_congregation_id is null or not exists (select 1 from public.congregations where id = p_congregation_id) then
    raise exception 'Invalid or missing congregation.';
  end if;
  if not public.ward_belongs_to(p_ward_id, p_congregation_id) then
    raise exception 'Invalid or missing ward for this congregation.';
  end if;
  if not public.league_belongs_to(claims_league_id, p_congregation_id) then
    raise exception 'Invalid league for this congregation.';
  end if;

  if p_family_code is not null then
    select id, name into v_household_id, v_household_name from public.households
    where code = upper(p_family_code) and congregation_id = p_congregation_id;
    if v_household_id is null then
      raise exception 'Invalid family code.';
    end if;
    if v_household_name is null then
      update public.households set name = public.derive_family_name(p_full_name) where id = v_household_id;
    end if;
  else
    v_surname := public.derive_surname(p_full_name);
    if v_surname <> '' then
      select array_agg(distinct h.id) into v_match_ids
      from public.households h
      join public.profiles p on p.household_id = h.id
      where h.congregation_id = p_congregation_id
        and p.ward_id = p_ward_id
        and public.derive_surname(p.full_name) = v_surname;
      if v_match_ids is not null and array_length(v_match_ids, 1) = 1 then
        v_household_id := v_match_ids[1];
        v_auto_merged := true;
      end if;
    end if;

    if v_household_id is null then
      loop
        v_new_code := public.generate_household_code();
        begin
          insert into public.households (congregation_id, code, name)
          values (p_congregation_id, v_new_code, public.derive_family_name(p_full_name))
          returning id into v_household_id;
          exit;
        exception when unique_violation then
          -- code collision — try another
        end;
      end loop;
    end if;
  end if;

  insert into public.profiles (
    id, full_name, email, phone, date_of_birth, gender, congregation_id, ward_id, household_id,
    league_id, baptised, confirmed,
    league_application, baptism_application, confirmation_application
  )
  values (
    new.id,
    p_full_name,
    new.email,
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'gender', '')::gender,
    p_congregation_id,
    p_ward_id,
    v_household_id,
    claims_league_id,
    claims_baptised,
    claims_confirmed,
    case when claims_league_id is null then null else
      jsonb_build_object(
        'reason', new.raw_user_meta_data->>'league_reason', 'submitted_at', now(),
        'baptism_certificate', new.raw_user_meta_data->>'baptism_certificate', 'confirmation_certificate', new.raw_user_meta_data->>'confirmation_certificate'
      )
    end,
    case when not claims_baptised then null else
      jsonb_build_object(
        'type', new.raw_user_meta_data->>'baptism_type', 'sponsor_name', new.raw_user_meta_data->>'sponsor_name',
        'location', new.raw_user_meta_data->>'baptism_location', 'officiant_name', new.raw_user_meta_data->>'baptism_officiant',
        'submitted_at', now()
      )
    end,
    case when not claims_confirmed then null else
      jsonb_build_object(
        'mentor_name', new.raw_user_meta_data->>'mentor_name',
        'location', new.raw_user_meta_data->>'confirmation_location', 'officiant_name', new.raw_user_meta_data->>'confirmation_officiant',
        'submitted_at', now()
      )
    end
  );

  if v_auto_merged then
    insert into public.household_auto_merges (household_id, profile_id, matched_surname)
    values (v_household_id, new.id, v_surname);
  end if;

  return new;
end;
$$;
