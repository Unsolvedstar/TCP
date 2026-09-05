-- Service/utility accounts (e.g. the generic per-league admin logins from
-- scripts/create-league-admin-accounts.mjs) are real profiles rows so they
-- can hold a league_admins assignment like anyone else, but they aren't an
-- actual congregant — counting them inflates headcount/ward/gender/
-- sacrament stats. Flagged explicitly at creation via a new metadata key
-- rather than sniffed from email domain, since that's admin-configurable
-- (see EMAIL_DOMAIN in the provisioning script) and shouldn't leak into a
-- stats query as an assumption.

alter table public.profiles add column if not exists is_service_account boolean not null default false;

-- Re-declared in full from its latest form in 0018_profile_email.sql (same
-- "re-declare, don't edit the old file" convention every migration here
-- uses) — the only change is capturing new metadata's is_service_account
-- flag onto the profiles row.
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
  p_is_service_account boolean := coalesce((new.raw_user_meta_data->>'is_service_account')::boolean, false);
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
    league_id, baptised, confirmed, is_service_account,
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
    p_is_service_account,
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

  -- A service account is its own thing, not a family — skip the auto-merge
  -- bookkeeping table entirely even though v_auto_merged could theoretically
  -- be true (e.g. two league accounts sharing a surname and ward).
  if v_auto_merged and not p_is_service_account then
    insert into public.household_auto_merges (household_id, profile_id, matched_surname)
    values (v_household_id, new.id, v_surname);
  end if;

  return new;
end;
$$;

-- Stats RPCs: re-declared from their latest form (0011_age_groups.sql for
-- stats_sacraments, 0001_init.sql for the other three) with one addition —
-- excluding is_service_account rows, same "role = 'member'" filter these
-- already apply to leave admins out.

create or replace function public.stats_by_ward()
returns table(ward_id uuid, cnt bigint)
language sql security definer set search_path = public stable
as $$
  select ward_id, count(*) from (
    select ward_id, congregation_id from public.profiles where role = 'member' and not is_service_account
    union all
    select d.ward_id, p.congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id
  ) x
  where congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  group by ward_id;
$$;

create or replace function public.stats_by_league()
returns table(league_id uuid, cnt bigint)
language sql security definer set search_path = public stable
as $$
  select league_id, count(*) from (
    select league_id, congregation_id from public.profiles where role = 'member' and not is_service_account
    union all
    select d.league_id, p.congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id
  ) x
  where congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  group by league_id;
$$;

create or replace function public.stats_by_gender()
returns table(gender gender, cnt bigint)
language sql security definer set search_path = public stable
as $$
  select gender, count(*) from (
    select gender, congregation_id from public.profiles where role = 'member' and not is_service_account
    union all
    select d.gender, p.congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id
  ) x
  where congregation_id = (select congregation_id from public.profiles where id = auth.uid()) and gender is not null
  group by gender;
$$;

create or replace function public.stats_sacraments()
returns table(total bigint, baptised bigint, confirmed bigint, adults bigint, children bigint, elders bigint)
language sql security definer set search_path = public stable
as $$
  with people as (
    select baptised, confirmed, date_of_birth, false as fallback_is_child, congregation_id
    from public.profiles where role = 'member' and not is_service_account
    union all
    select d.baptised, d.confirmed, d.date_of_birth, true as fallback_is_child, p.congregation_id
    from public.dependents d join public.profiles p on p.id = d.guardian_id
  ),
  classified as (
    select
      baptised, confirmed,
      coalesce(public.age_group(date_of_birth), case when fallback_is_child then 'child' else 'adult' end) as bracket
    from people
    where congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  )
  select
    count(*),
    count(*) filter (where baptised),
    count(*) filter (where confirmed),
    count(*) filter (where bracket = 'adult'),
    count(*) filter (where bracket = 'child'),
    count(*) filter (where bracket = 'elder')
  from classified;
$$;
