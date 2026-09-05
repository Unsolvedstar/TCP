-- Family codes: every household gets a short, shareable code, and a code is
-- mandatory to register at all — there is no such thing as a member with no
-- family. Admins mint codes in batches ahead of time (admin_generate_
-- household_codes, section 2) the same way physical membership cards get
-- handed out; each code starts as an unclaimed, unnamed slot. Whoever first
-- registers (or later joins from their portal) with a given code claims it —
-- the family is auto-named from that person's own surname right then, no
-- one has to type a family name anywhere. Anyone else who is handed that
-- same exact code and enters it joins the same family immediately, no admin
-- review needed. Unlike fuzzy matching (e.g. same surname), a code is a
-- deliberate, unambiguous confirmation from the person typing it, so
-- instant assignment carries none of the "two unrelated people with the
-- same surname get merged" risk fuzzy matching would. Admins never
-- originate a *family* (a named, populated household) — only the raw code
-- pool. They can still find an existing family (search in the Families
-- tab) and manage it (rename, delete, regenerate the code, assign/remove an
-- existing member) as a fallback/override.

-- 1. Add + backfill the code column ------------------------------------------

alter table public.households add column if not exists code text;

-- Alphabet skips 0/O/1/I/L so a code read aloud or handwritten is never
-- ambiguous. 6 chars from a 32-symbol alphabet is ~1 billion combinations —
-- collisions are checked for (retry loop below) but shouldn't come up.
create or replace function public.generate_household_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

-- Backfill any households created before this migration (e.g. via the
-- admin Families tab earlier this session) with a real code each, then lock
-- the column down. One row at a time so retrying on a collision is simple.
do $$
declare
  h record;
  new_code text;
begin
  for h in select id from public.households where code is null loop
    loop
      new_code := public.generate_household_code();
      begin
        update public.households set code = new_code where id = h.id;
        exit;
      exception when unique_violation then
        -- try again with a fresh code
      end;
    end loop;
  end loop;
end $$;

alter table public.households alter column code set not null;
do $$ begin
  alter table public.households add constraint households_code_key unique (code);
exception when duplicate_object then null;
end $$;

-- 2. Naming a family from whoever first claims its code ---------------------
-- No one ever types a family name — it's derived from the surname (the last
-- word) of whoever first registers or joins with that code. Falls back to a
-- generic name for the rare edge case of a blank/single-token full name.

create or replace function public.derive_family_name(p_full_name text)
returns text
language plpgsql immutable
as $$
declare
  parts text[];
begin
  parts := regexp_split_to_array(trim(coalesce(p_full_name, '')), '\s+');
  if parts = '{}' or parts = array[''] then
    return 'New Family';
  end if;
  return parts[array_length(parts, 1)] || ' Family';
end;
$$;

-- 3. Admin mints a batch of unclaimed codes ----------------------------------
-- This is the *only* way a brand-new family originates — an admin never
-- names or populates a household directly, they just mint blank code slots
-- (name stays null) for members to claim themselves at registration or from
-- their portal. Capped at 100 per call, same spirit as generating a batch of
-- physical membership cards.

create or replace function public.admin_generate_household_codes(p_count int default 20)
returns table(id uuid, code text)
language plpgsql security definer set search_path = public
as $$
declare
  -- profiles.id must be qualified: the OUT parameter `id` above is in scope
  -- for the whole function body, including this initializer, and an
  -- unqualified `id` is ambiguous between the two.
  my_congregation_id uuid := (select congregation_id from public.profiles where profiles.id = auth.uid());
  new_code text;
  new_id uuid;
  i int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_count is null or p_count < 1 or p_count > 100 then
    raise exception 'Please generate between 1 and 100 codes at a time.';
  end if;
  for i in 1..p_count loop
    loop
      new_code := public.generate_household_code();
      begin
        insert into public.households (congregation_id, code, created_by)
        values (my_congregation_id, new_code, auth.uid())
        returning households.id into new_id;
        exit;
      exception when unique_violation then
        -- code collision — try another
      end;
    end loop;
    id := new_id;
    code := new_code;
    return next;
  end loop;
end;
$$;

grant execute on function public.admin_generate_household_codes(int) to authenticated;

-- 4. Admin can mint a fresh code for an existing family (e.g. if the old one
-- leaked) ---------------------------------------------------------------
-- Purely a future join key — regenerating never touches anyone already
-- assigned to the family.

create or replace function public.admin_regenerate_household_code(target_id uuid)
returns text language plpgsql security definer set search_path = public
as $$
declare
  target_congregation_id uuid;
  new_code text;
begin
  select congregation_id into target_congregation_id from public.households where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  loop
    new_code := public.generate_household_code();
    begin
      update public.households set code = new_code where id = target_id;
      exit;
    exception when unique_violation then
      -- code collision — try another
    end;
  end loop;
  return new_code;
end;
$$;

grant execute on function public.admin_regenerate_household_code(uuid) to authenticated;

-- 5. Self-service: join a family by code -------------------------------------
-- Scoped to the caller's own congregation even though codes are globally
-- unique, so a code can never pull someone into a family in another tenant.
-- Cascades onto the caller's existing dependents too — joining a family
-- should bring your kids with you, not just yourself. If this is the code's
-- first-ever claim (an admin-minted slot, name still null), the family is
-- named from the caller's own surname right here.

create or replace function public.join_family_by_code(p_code text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  my_congregation_id uuid;
  my_full_name text;
  target_household_id uuid;
  target_name text;
begin
  select congregation_id, full_name into my_congregation_id, my_full_name
  from public.profiles where id = auth.uid();

  select id, name into target_household_id, target_name from public.households
  where code = upper(trim(p_code)) and congregation_id = my_congregation_id;
  if target_household_id is null then
    raise exception 'Invalid family code.';
  end if;

  if target_name is null then
    update public.households set name = public.derive_family_name(my_full_name) where id = target_household_id;
  end if;

  update public.profiles set household_id = target_household_id where id = auth.uid();
  update public.dependents set household_id = target_household_id where guardian_id = auth.uid();
  return target_household_id;
end;
$$;

grant execute on function public.join_family_by_code(text) to authenticated;

-- 6. Self-service: read my own family's name/code ----------------------------
-- households stays admin-only for direct SELECT (see 0013) — this is the
-- same "narrow RPC instead of relaxing RLS" approach as the pre-auth
-- congregation lookups in section 4 of 0001_init.sql.

create or replace function public.my_family()
returns table(id uuid, name text, code text)
language sql security definer set search_path = public stable
as $$
  select h.id, h.name, h.code
  from public.households h
  join public.profiles p on p.household_id = h.id
  where p.id = auth.uid();
$$;

grant execute on function public.my_family() to authenticated;

-- 7. Pre-auth: validate a family code before submitting registration --------
-- GoTrue doesn't surface a rejected signup trigger's exception text to the
-- client — a handle_new_user() failure (section 8) always comes back as an
-- opaque, message-less error, regardless of *why* it failed. A normal RPC
-- call doesn't have that problem (Postgres errors come through as-is), so
-- the registration screen calls this first and shows *that* error, the same
-- pre-auth-RPC approach get_congregation_by_slug() etc. already use in
-- section 4 of 0001_init.sql.

create or replace function public.check_family_code(p_congregation_id uuid, p_code text)
returns boolean
language plpgsql security definer set search_path = public stable
as $$
begin
  if not exists (
    select 1 from public.households
    where code = upper(trim(p_code)) and congregation_id = p_congregation_id
  ) then
    raise exception 'Invalid family code.';
  end if;
  return true;
end;
$$;

grant execute on function public.check_family_code(uuid, text) to anon, authenticated;

-- 8. Registration requires a family code -------------------------------------
-- Re-declared in full from 0001_init.sql (same "re-declare, don't edit the
-- old file" convention 0004_league_admins.sql uses) with one addition: the
-- signup metadata's `family_code` is mandatory and must match a household
-- (admin-minted or already active) in the new profile's own congregation —
-- there's no such thing as registering with no family. If this is the
-- code's first-ever claim, the family is named from the new member's own
-- surname right here, same as join_family_by_code (section 5).

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

  if p_family_code is null then
    raise exception 'A family code is required to register.';
  end if;
  select id, name into v_household_id, v_household_name from public.households
  where code = upper(p_family_code) and congregation_id = p_congregation_id;
  if v_household_id is null then
    raise exception 'Invalid family code.';
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

  if v_household_name is null then
    update public.households set name = public.derive_family_name(p_full_name) where id = v_household_id;
  end if;

  return new;
end;
$$;

-- 9. Bootstrap: one starter code so the very first real person can register --
-- TCP is the only congregation right now (multi-congregation is a later
-- project) and it has no admin yet to mint codes the normal way (section 3),
-- so this seeds exactly one unclaimed slot the same way the "first admin"
-- step in 0001_init.sql is a one-off manual bootstrap. Whoever registers
-- with it becomes TCP's first family and, per that same runbook, gets
-- manually promoted to admin — from there they can mint codes for everyone
-- else via admin_generate_household_codes.
do $$
declare
  tcp_id uuid;
  starter_code text;
begin
  select id into tcp_id from public.congregations where slug = 'tshwane-city-parish';
  if tcp_id is not null and not exists (select 1 from public.households where congregation_id = tcp_id) then
    loop
      starter_code := public.generate_household_code();
      begin
        insert into public.households (congregation_id, code) values (tcp_id, starter_code);
        exit;
      exception when unique_violation then
      end;
    end loop;
  end if;
end $$;
