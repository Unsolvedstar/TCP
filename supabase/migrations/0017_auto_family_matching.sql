-- Auto-match families at registration, no code and no asking -----------------
-- 0016 made every signup mint its own brand-new family code, which solved
-- "there's no such thing as registering with no family" but introduced a new
-- problem: two actual relatives who each register separately end up as two
-- separate one-person families, and the only way to fix that was one of them
-- asking the other for their code. A suggestion box and a portal nudge (both
-- superseded by this migration) still required that same ask, just phrased
-- differently.
--
-- This replaces all of that with a silent match at signup: same
-- congregation + same ward + exact surname match onto an existing family,
-- no code, no prompt, no approval from anyone. That trades a small
-- false-merge rate (two unrelated same-surname households in the same ward)
-- for removing the ask entirely — every such auto-merge is logged in
-- household_auto_merges below so an admin can catch and undo the rare wrong
-- one from the Families tab, instead of a human having to gate every merge
-- up front. Only an *unambiguous* match (exactly one candidate family) is
-- ever auto-merged; anything ambiguous just starts a new family, same as
-- the no-match case.
--
-- Explicit family codes (admin-minted batches, printed cards, the existing
-- Join Family flow in the portal) still work unchanged — this only changes
-- what happens when nobody supplies a code at all, which is now every
-- ordinary signup.

create or replace function public.derive_surname(p_full_name text)
returns text
language sql immutable
as $$
  select upper(
    (regexp_split_to_array(trim(coalesce(p_full_name, '')), '\s+'))
    [array_upper(regexp_split_to_array(trim(coalesce(p_full_name, '')), '\s+'), 1)]
  );
$$;

-- Audit trail of silent merges, so admins have something concrete to review
-- instead of blind trust. Unreviewed rows show up in the Families tab; an
-- admin either confirms (yes, that's really their family) or splits the
-- person back out into their own new family.
create table if not exists public.household_auto_merges (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  matched_surname text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

alter table public.household_auto_merges enable row level security;

drop policy if exists "household_auto_merges: select" on public.household_auto_merges;
create policy "household_auto_merges: select" on public.household_auto_merges
  for select using (
    exists (select 1 from public.households h where h.id = household_auto_merges.household_id and public.is_admin_of(h.congregation_id))
  );

grant select on public.household_auto_merges to authenticated;
grant all on public.household_auto_merges to service_role;
-- No insert/update/delete grants for authenticated — mutated only via
-- handle_new_user() and the admin_*_auto_merge() functions below.

-- Re-declared in full from its latest form in 0016_self_service_family_code.sql
-- (same "re-declare, don't edit the old file" convention every migration
-- here uses). family_code is now optional: if supplied, behaves exactly as
-- before (explicit code claim/join). If omitted — the normal case now that
-- the registration screen no longer asks for one — this auto-matches onto
-- an existing family by surname+ward, or starts a new one.
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
    id, full_name, phone, date_of_birth, gender, congregation_id, ward_id, household_id,
    league_id, baptised, confirmed,
    league_application, baptism_application, confirmation_application
  )
  values (
    new.id,
    p_full_name,
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

-- Admin review of auto-merges ------------------------------------------------

create or replace function public.admin_list_auto_merge_flags()
returns table(
  id uuid,
  household_id uuid,
  household_name text,
  profile_id uuid,
  profile_name text,
  matched_surname text,
  created_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select m.id, m.household_id, h.name, m.profile_id, p.full_name, m.matched_surname, m.created_at
  from public.household_auto_merges m
  join public.households h on h.id = m.household_id
  join public.profiles p on p.id = m.profile_id
  where m.reviewed_at is null
    and public.is_admin_of(h.congregation_id)
  order by m.created_at desc;
$$;

grant execute on function public.admin_list_auto_merge_flags() to authenticated;

create or replace function public.admin_confirm_auto_merge(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_congregation_id uuid;
begin
  select h.congregation_id into v_congregation_id
  from public.household_auto_merges m join public.households h on h.id = m.household_id
  where m.id = target_id;
  if v_congregation_id is null or not public.is_admin_of(v_congregation_id) then raise exception 'not authorized'; end if;
  update public.household_auto_merges set reviewed_at = now(), reviewed_by = auth.uid() where id = target_id;
end;
$$;

grant execute on function public.admin_confirm_auto_merge(uuid) to authenticated;

create or replace function public.admin_split_auto_merge(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_congregation_id uuid;
  v_profile_id uuid;
  v_full_name text;
  v_new_household_id uuid;
  v_new_code text;
begin
  select h.congregation_id, m.profile_id into v_congregation_id, v_profile_id
  from public.household_auto_merges m join public.households h on h.id = m.household_id
  where m.id = target_id;
  if v_congregation_id is null or not public.is_admin_of(v_congregation_id) then raise exception 'not authorized'; end if;

  select full_name into v_full_name from public.profiles where id = v_profile_id;

  loop
    v_new_code := public.generate_household_code();
    begin
      insert into public.households (congregation_id, code, name, created_by)
      values (v_congregation_id, v_new_code, public.derive_family_name(v_full_name), auth.uid())
      returning id into v_new_household_id;
      exit;
    exception when unique_violation then
      -- code collision — try another
    end;
  end loop;

  update public.profiles set household_id = v_new_household_id where id = v_profile_id;
  update public.dependents set household_id = v_new_household_id where guardian_id = v_profile_id;
  update public.household_auto_merges set reviewed_at = now(), reviewed_by = auth.uid() where id = target_id;
end;
$$;

grant execute on function public.admin_split_auto_merge(uuid) to authenticated;
