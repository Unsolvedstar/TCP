-- ELCSA multi-congregation core schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) on a fresh project.
-- Safe to paste and run again on a project that already has it applied — every
-- statement here is written to skip/replace rather than error the second time.
--
-- Design note: every WRITE to `profiles` (besides your own phone number and the
-- pending_* "request" flags) goes through a security-definer RPC function that
-- checks authorization itself. This means table-level UPDATE is never granted
-- directly to app users — so a member can never set their own `role`, `baptised`,
-- `confirmed` or someone else's data by crafting a raw update, no matter what the
-- client-side app code does. All the actual security lives here, in Postgres.
--
-- Multi-tenancy note: every congregation is a row in `congregations`, and every
-- `wards`/`leagues` row belongs to exactly one congregation. `profiles` carries
-- its own `congregation_id`; `dependents` has no `congregation_id` column of its
-- own — it's always derived via `guardian_id -> profiles.congregation_id`, since
-- a dependent's tenancy can never differ from the guardian who owns the record.
-- Every RLS policy and admin RPC below scopes cross-member reads/writes to "same
-- congregation as the target", not just "is an admin somewhere".

-- 1. Enums -------------------------------------------------------------
-- Postgres has no `create type if not exists`, so each is wrapped to make the
-- whole file safe to paste and run again (e.g. after pulling a later change to
-- one of the functions below) without erroring on "type already exists".
--
-- `ward` and `league` are NOT enums anymore — congregations define their own
-- wards/leagues as table rows (see section 1a), since a fixed global list of
-- 5 wards / 10 leagues only ever made sense for one specific congregation.

do $$ begin
  create type app_role as enum ('member','admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type gender as enum ('Male','Female');
exception when duplicate_object then null;
end $$;

-- Drop the old single-tenant enums now that nothing references them (safe to
-- run even if they were already dropped by a prior run of this file, or never
-- existed on a fresh project).
drop type if exists ward;
drop type if exists league;

-- 1a. Congregations, wards, leagues ---------------------------------------
-- One `congregations` row per tenant. `wards`/`leagues` are per-congregation
-- lookup tables — what used to be a hardcoded 5-value / 10-value enum is now
-- data, so a new congregation can define its own without a schema change.

create table if not exists public.congregations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  domain text,
  tagline text,
  created_at timestamptz not null default now()
);

create table if not exists public.wards (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  name text not null,
  bank_code int not null,
  color text not null default '#888888',
  unique (congregation_id, name)
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  key text not null,
  label text not null,
  info text,
  color text not null default '#888888',
  has_badge boolean not null default false,
  unique (congregation_id, key)
);

alter table public.congregations enable row level security;
alter table public.wards enable row level security;
alter table public.leagues enable row level security;

-- RLS policies for these three tables are defined further down, right after
-- `profiles` (section 2) — they reference `public.profiles.congregation_id`,
-- which requires that table to already exist at CREATE POLICY time.

-- 2. Profiles ------------------------------------------------------------
-- One row per auth.users row, created automatically on sign-up (trigger below).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  date_of_birth date,
  gender gender,
  congregation_id uuid not null references public.congregations(id),
  ward_id uuid not null references public.wards(id),
  role app_role not null default 'member',
  league_id uuid references public.leagues(id),
  baptised boolean not null default false,
  confirmed boolean not null default false,
  pending_league_id uuid references public.leagues(id),
  pending_baptism boolean not null default false,
  pending_confirmation boolean not null default false,
  -- Free-form answers + a drawn signature (data URI) attached to whichever
  -- request is currently pending — set by request_*() below, cleared once an
  -- admin approves or denies it. Kept as jsonb rather than fixed columns so
  -- the question set can change later without another migration.
  baptism_application jsonb,
  confirmation_application jsonb,
  league_application jsonb,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Helper: is the current user an admin OF the given congregation? Every
-- cross-member admin action below checks this against the *target's*
-- congregation, not just "is an admin somewhere" — otherwise an admin of
-- Congregation A could act on Congregation B's members. `coalesce`s to false
-- (rather than erroring) when the caller has no profile, isn't an admin, or
-- `target_congregation_id` is null (e.g. a bad/missing target row) so callers
-- can treat it as a plain boolean gate.
create or replace function public.is_admin_of(target_congregation_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select role = 'admin' and congregation_id = target_congregation_id from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Helpers: does this ward/league actually belong to this congregation? Every
-- RPC that accepts a client-supplied ward_id/league_id validates it through
-- these before writing it anywhere, so a crafted call can't plant a
-- cross-tenant id into someone's record. `league_belongs_to` treats a null
-- league_id (= "no league") as always valid, since it's a legitimate value
-- for every congregation.
create or replace function public.ward_belongs_to(p_ward_id uuid, p_congregation_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.wards where id = p_ward_id and congregation_id = p_congregation_id);
$$;

create or replace function public.league_belongs_to(p_league_id uuid, p_congregation_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select p_league_id is null or exists(select 1 from public.leagues where id = p_league_id and congregation_id = p_congregation_id);
$$;

-- Read access: your own row, or every row in your own congregation if you're
-- an admin. (Congregation-wide chart data for ordinary members comes from the
-- anonymised stats_* functions below, not from reading other people's profile
-- rows.)
drop policy if exists "profiles: select" on public.profiles;
create policy "profiles: select" on public.profiles
  for select using (auth.uid() = id or public.is_admin_of(congregation_id));

grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- Signed-in users can only read their own congregation's rows — never every
-- tenant's. Pre-auth access (the registration screen's ward/league picker,
-- before a profile even exists) goes through the narrow RPCs in section 4,
-- not a blanket anon grant on these tables. Defined here (rather than
-- alongside their table definitions above) because these policies reference
-- `public.profiles`, which has to exist first.
drop policy if exists "congregations: select own" on public.congregations;
create policy "congregations: select own" on public.congregations
  for select using (id = (select congregation_id from public.profiles where id = auth.uid()));

drop policy if exists "wards: select own congregation" on public.wards;
create policy "wards: select own congregation" on public.wards
  for select using (congregation_id = (select congregation_id from public.profiles where id = auth.uid()));

drop policy if exists "leagues: select own congregation" on public.leagues;
create policy "leagues: select own congregation" on public.leagues
  for select using (congregation_id = (select congregation_id from public.profiles where id = auth.uid()));

grant select on public.congregations to authenticated;
grant select on public.wards to authenticated;
grant select on public.leagues to authenticated;

-- service_role bypasses RLS, but Postgres privilege checks are separate from
-- RLS and still apply — without an explicit grant, even service_role gets
-- "permission denied" on a table with no ambient default privilege for it
-- (observed directly against the local CLI's Postgres image; relying on an
-- assumed default here would be fragile). Every table below gets the same
-- explicit grant for that reason, not just these three.
grant all on public.congregations to service_role;
grant all on public.wards to service_role;
grant all on public.leagues to service_role;

-- No insert/update/delete grants for profiles at all — every mutation below
-- happens inside a security-definer function that runs with elevated rights and
-- does its own authorization check, so no RLS/grant policy is required or relied on.

-- Auto-create a profile row when someone signs up via Supabase Auth.
-- Full name / phone / congregation / ward are passed in as auth signUp()
-- "data" (user_metadata). There is no per-congregation default ward — a
-- global default only ever made sense for one specific congregation, so
-- signup is rejected outright if congregation_id/ward_id are missing or
-- don't match each other, rather than silently falling back to something.
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

  -- What someone claims at sign-up (already baptised/confirmed, already in a
  -- league) is recorded as fact straight away, not a pending request — it's a
  -- statement about something that already happened, not a future event the
  -- office needs to schedule. The signature/sponsor/certificate details are
  -- still captured and kept as an attestation record alongside it. Joining a
  -- league, or requesting baptism/confirmation, *later* from the portal is
  -- different — those go through request_*() below and still need admin
  -- approval, since they're new events the church has to arrange. Confirmation
  -- without also claiming baptism is nonsensical, so it's dropped rather than
  -- trusted.
  insert into public.profiles (
    id, full_name, phone, date_of_birth, gender, congregation_id, ward_id,
    league_id, baptised, confirmed,
    league_application, baptism_application, confirmation_application
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'gender', '')::gender,
    p_congregation_id,
    p_ward_id,
    claims_league_id,
    claims_baptised,
    claims_confirmed,
    case when claims_league_id is null then null else
      jsonb_build_object(
        'reason', new.raw_user_meta_data->>'league_reason', 'signature', new.raw_user_meta_data->>'signature', 'signed_at', now(),
        'baptism_certificate', new.raw_user_meta_data->>'baptism_certificate', 'confirmation_certificate', new.raw_user_meta_data->>'confirmation_certificate'
      )
    end,
    case when not claims_baptised then null else
      jsonb_build_object('type', new.raw_user_meta_data->>'baptism_type', 'sponsor_name', new.raw_user_meta_data->>'sponsor_name', 'signature', new.raw_user_meta_data->>'signature', 'signed_at', now())
    end,
    case when not claims_confirmed then null else
      jsonb_build_object(
        'mentor_name', new.raw_user_meta_data->>'mentor_name', 'signature', new.raw_user_meta_data->>'signature', 'signed_at', now(),
        'baptism_certificate', new.raw_user_meta_data->>'baptism_certificate'
      )
    end
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2a. Member self-service actions (each only ever touches auth.uid()'s own row) ---

create or replace function public.update_my_phone(new_phone text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set phone = new_phone where id = auth.uid();
end;
$$;

create or replace function public.update_my_birthday(new_dob date)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set date_of_birth = new_dob where id = auth.uid();
end;
$$;

create or replace function public.update_my_gender(new_gender gender)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set gender = new_gender where id = auth.uid();
end;
$$;

create or replace function public.request_league(
  new_league_id uuid, p_reason text default null, p_signature text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.league_belongs_to(new_league_id, (select congregation_id from public.profiles where id = auth.uid())) then
    raise exception 'Invalid league.';
  end if;
  update public.profiles set
    pending_league_id = new_league_id,
    league_application = jsonb_build_object(
      'reason', p_reason, 'signature', p_signature, 'signed_at', now(),
      'baptism_certificate', p_baptism_certificate, 'confirmation_certificate', p_confirmation_certificate
    )
  where id = auth.uid();
end;
$$;

create or replace function public.cancel_league_request()
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set pending_league_id = null, league_application = null where id = auth.uid();
end;
$$;

create or replace function public.request_baptism(p_type text default null, p_sponsor_name text default null, p_note text default null, p_signature text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set
    pending_baptism = true,
    baptism_application = jsonb_build_object('type', p_type, 'sponsor_name', p_sponsor_name, 'note', p_note, 'signature', p_signature, 'signed_at', now())
  where id = auth.uid();
end;
$$;

create or replace function public.cancel_baptism_request()
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set pending_baptism = false, baptism_application = null where id = auth.uid();
end;
$$;

create or replace function public.request_confirmation(
  p_mentor_name text default null, p_note text default null, p_signature text default null, p_baptism_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare already_baptised boolean;
begin
  select baptised into already_baptised from public.profiles where id = auth.uid();
  if not coalesce(already_baptised, false) then
    raise exception 'Baptism is required before requesting Confirmation.';
  end if;
  update public.profiles set
    pending_confirmation = true,
    confirmation_application = jsonb_build_object(
      'mentor_name', p_mentor_name, 'note', p_note, 'signature', p_signature, 'signed_at', now(), 'baptism_certificate', p_baptism_certificate
    )
  where id = auth.uid();
end;
$$;

create or replace function public.cancel_confirmation_request()
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set pending_confirmation = false, confirmation_application = null where id = auth.uid();
end;
$$;

grant execute on function public.update_my_phone(text) to authenticated;
grant execute on function public.update_my_birthday(date) to authenticated;
grant execute on function public.update_my_gender(gender) to authenticated;
grant execute on function public.request_league(uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_league_request() to authenticated;
grant execute on function public.request_baptism(text, text, text, text) to authenticated;
grant execute on function public.cancel_baptism_request() to authenticated;
grant execute on function public.request_confirmation(text, text, text, text) to authenticated;
grant execute on function public.cancel_confirmation_request() to authenticated;

-- 2b. Admin actions (every function below checks is_admin_of() against the
-- TARGET's own congregation, resolved first, not just "is an admin somewhere") ---

create or replace function public.approve_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  -- Defense in depth: request_league() already validated the pending league
  -- belongs to this congregation at request time, but this is the last point
  -- before it becomes a permanent value, so re-check it here too.
  if not public.league_belongs_to((select pending_league_id from public.profiles where id = target_id), target_congregation_id) then
    raise exception 'Pending league does not belong to this congregation.';
  end if;
  update public.profiles set league_id = pending_league_id, pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.profiles set pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.profiles set baptised = true, pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.profiles set pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.profiles set confirmed = true, pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.profiles set pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

-- Admin edits any member's core fields (used by the Members screen's edit form).
create or replace function public.admin_update_member(
  target_id uuid, p_full_name text, p_phone text, p_ward_id uuid,
  p_league_id uuid, p_baptised boolean, p_confirmed boolean,
  p_date_of_birth date default null, p_gender gender default null
) returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if not public.ward_belongs_to(p_ward_id, target_congregation_id) then raise exception 'Invalid ward.'; end if;
  if not public.league_belongs_to(p_league_id, target_congregation_id) then raise exception 'Invalid league.'; end if;
  update public.profiles set
    full_name = p_full_name, phone = p_phone, ward_id = p_ward_id,
    league_id = p_league_id, baptised = p_baptised, confirmed = p_confirmed,
    date_of_birth = p_date_of_birth, gender = p_gender
  where id = target_id;
end;
$$;

-- Promote/demote admin access. Guard against removing the last remaining
-- admin *within the target's own congregation* — another congregation having
-- plenty of admins doesn't help this one.
create or replace function public.admin_set_role(target_id uuid, new_role app_role)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid; admin_count int;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if new_role = 'member' then
    select count(*) into admin_count from public.profiles where role = 'admin' and congregation_id = target_congregation_id;
    if admin_count <= 1 and (select role from public.profiles where id = target_id) = 'admin' then
      raise exception 'Cannot remove the last remaining admin.';
    end if;
  end if;
  update public.profiles set role = new_role where id = target_id;
end;
$$;

create or replace function public.admin_remove_member(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  delete from public.profiles where id = target_id;
end;
$$;

grant execute on function public.approve_league(uuid) to authenticated;
grant execute on function public.deny_league(uuid) to authenticated;
grant execute on function public.approve_baptism(uuid) to authenticated;
grant execute on function public.deny_baptism(uuid) to authenticated;
grant execute on function public.approve_confirmation(uuid) to authenticated;
grant execute on function public.deny_confirmation(uuid) to authenticated;
grant execute on function public.admin_update_member(uuid,text,text,uuid,uuid,boolean,boolean,date,gender) to authenticated;
grant execute on function public.admin_set_role(uuid, app_role) to authenticated;
grant execute on function public.admin_remove_member(uuid) to authenticated;

-- 2c. Dependents (children who don't have their own phone/account) ---------------
-- Owned by a "guardian" profile. No login of their own — the guardian (or an
-- admin) manages their record and requests on their behalf. No congregation_id
-- column here on purpose: a dependent's congregation is always the guardian's
-- (see the note at the top of the file), so it's derived via guardian_id
-- everywhere rather than duplicated and risking drift.

create table if not exists public.dependents (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  gender gender,
  ward_id uuid not null references public.wards(id),
  league_id uuid references public.leagues(id),
  baptised boolean not null default false,
  confirmed boolean not null default false,
  pending_league_id uuid references public.leagues(id),
  pending_baptism boolean not null default false,
  pending_confirmation boolean not null default false,
  baptism_application jsonb,
  confirmation_application jsonb,
  league_application jsonb,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.dependents enable row level security;

drop policy if exists "dependents: select" on public.dependents;
create policy "dependents: select" on public.dependents
  for select using (
    guardian_id = auth.uid()
    or public.is_admin_of((select congregation_id from public.profiles where id = dependents.guardian_id))
  );

grant select on public.dependents to authenticated;
grant all on public.dependents to service_role;
-- Same pattern as profiles: no direct insert/update/delete grants for
-- authenticated — every mutation goes through a security-definer function
-- that checks ownership itself.

create or replace function public.add_dependent(
  p_full_name text, p_date_of_birth date, p_ward_id uuid, p_gender gender default null,
  p_initial_league_id uuid default null, p_already_baptised boolean default false, p_already_confirmed boolean default false,
  p_baptism_type text default null, p_sponsor_name text default null, p_mentor_name text default null,
  p_league_reason text default null, p_signature text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  my_congregation_id uuid := (select congregation_id from public.profiles where id = auth.uid());
  claims_baptised boolean := coalesce(p_already_baptised, false);
  claims_confirmed boolean := coalesce(p_already_confirmed, false) and claims_baptised;
begin
  -- Congregation is always inherited from the guardian's own profile, never
  -- taken from the client — a guardian can only ever add a dependent to their
  -- own congregation.
  if not public.ward_belongs_to(p_ward_id, my_congregation_id) then
    raise exception 'Invalid ward.';
  end if;
  if not public.league_belongs_to(p_initial_league_id, my_congregation_id) then
    raise exception 'Invalid league.';
  end if;

  -- Same rule as new adult sign-ups: what a guardian claims here is recorded as
  -- fact straight away, not a pending request — see handle_new_user() above.
  insert into public.dependents (
    guardian_id, full_name, date_of_birth, ward_id, gender,
    league_id, baptised, confirmed,
    league_application, baptism_application, confirmation_application
  )
  values (
    auth.uid(), p_full_name, p_date_of_birth, p_ward_id, p_gender,
    p_initial_league_id, claims_baptised, claims_confirmed,
    case when p_initial_league_id is null then null else
      jsonb_build_object(
        'reason', p_league_reason, 'signature', p_signature, 'signed_at', now(),
        'baptism_certificate', p_baptism_certificate, 'confirmation_certificate', p_confirmation_certificate
      )
    end,
    case when not claims_baptised then null else jsonb_build_object('type', p_baptism_type, 'sponsor_name', p_sponsor_name, 'signature', p_signature, 'signed_at', now()) end,
    case when not claims_confirmed then null else
      jsonb_build_object('mentor_name', p_mentor_name, 'signature', p_signature, 'signed_at', now(), 'baptism_certificate', p_baptism_certificate)
    end
  )
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.update_my_dependent(target_id uuid, p_full_name text, p_date_of_birth date, p_ward_id uuid, p_gender gender default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if not public.ward_belongs_to(p_ward_id, (select congregation_id from public.profiles where id = auth.uid())) then
    raise exception 'Invalid ward.';
  end if;
  update public.dependents set full_name = p_full_name, date_of_birth = p_date_of_birth, ward_id = p_ward_id, gender = p_gender where id = target_id;
end;
$$;

create or replace function public.remove_my_dependent(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  delete from public.dependents where id = target_id and guardian_id = auth.uid();
end;
$$;

create or replace function public.request_dependent_league(
  target_id uuid, new_league_id uuid, p_reason text default null, p_signature text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if not public.league_belongs_to(new_league_id, (select congregation_id from public.profiles where id = auth.uid())) then
    raise exception 'Invalid league.';
  end if;
  update public.dependents set
    pending_league_id = new_league_id,
    league_application = jsonb_build_object(
      'reason', p_reason, 'signature', p_signature, 'signed_at', now(),
      'baptism_certificate', p_baptism_certificate, 'confirmation_certificate', p_confirmation_certificate
    )
  where id = target_id;
end;
$$;

create or replace function public.cancel_dependent_league_request(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.dependents set pending_league_id = null, league_application = null where id = target_id and guardian_id = auth.uid();
end;
$$;

create or replace function public.request_dependent_baptism(target_id uuid, p_type text default null, p_sponsor_name text default null, p_note text default null, p_signature text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.dependents set
    pending_baptism = true,
    baptism_application = jsonb_build_object('type', p_type, 'sponsor_name', p_sponsor_name, 'note', p_note, 'signature', p_signature, 'signed_at', now())
  where id = target_id;
end;
$$;

create or replace function public.cancel_dependent_baptism_request(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.dependents set pending_baptism = false, baptism_application = null where id = target_id and guardian_id = auth.uid();
end;
$$;

create or replace function public.request_dependent_confirmation(
  target_id uuid, p_mentor_name text default null, p_note text default null, p_signature text default null, p_baptism_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare already_baptised boolean;
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  select baptised into already_baptised from public.dependents where id = target_id;
  if not coalesce(already_baptised, false) then
    raise exception 'Baptism is required before requesting Confirmation.';
  end if;
  update public.dependents set
    pending_confirmation = true,
    confirmation_application = jsonb_build_object(
      'mentor_name', p_mentor_name, 'note', p_note, 'signature', p_signature, 'signed_at', now(), 'baptism_certificate', p_baptism_certificate
    )
  where id = target_id;
end;
$$;

create or replace function public.cancel_dependent_confirmation_request(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.dependents set pending_confirmation = false, confirmation_application = null where id = target_id and guardian_id = auth.uid();
end;
$$;

grant execute on function public.add_dependent(text, date, uuid, gender, uuid, boolean, boolean, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_my_dependent(uuid, text, date, uuid, gender) to authenticated;
grant execute on function public.remove_my_dependent(uuid) to authenticated;
grant execute on function public.request_dependent_league(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_dependent_league_request(uuid) to authenticated;
grant execute on function public.request_dependent_baptism(uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_dependent_baptism_request(uuid) to authenticated;
grant execute on function public.request_dependent_confirmation(uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_dependent_confirmation_request(uuid) to authenticated;

-- 2d. Admin actions on dependents (mirrors 2b for profiles; target congregation
-- is always resolved via the dependent's guardian, since dependents carry no
-- congregation_id of their own) -----------------------------------------------

create or replace function public.approve_dependent_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if not public.league_belongs_to((select pending_league_id from public.dependents where id = target_id), target_congregation_id) then
    raise exception 'Pending league does not belong to this congregation.';
  end if;
  update public.dependents set league_id = pending_league_id, pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_dependent_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.dependents set pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_dependent_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.dependents set baptised = true, pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_dependent_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.dependents set pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_dependent_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.dependents set confirmed = true, pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_dependent_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.dependents set pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.admin_update_dependent(
  target_id uuid, p_full_name text, p_date_of_birth date, p_ward_id uuid,
  p_league_id uuid, p_baptised boolean, p_confirmed boolean, p_gender gender default null
) returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if not public.ward_belongs_to(p_ward_id, target_congregation_id) then raise exception 'Invalid ward.'; end if;
  if not public.league_belongs_to(p_league_id, target_congregation_id) then raise exception 'Invalid league.'; end if;
  update public.dependents set
    full_name = p_full_name, date_of_birth = p_date_of_birth, ward_id = p_ward_id,
    league_id = p_league_id, baptised = p_baptised, confirmed = p_confirmed, gender = p_gender
  where id = target_id;
end;
$$;

create or replace function public.admin_remove_dependent(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  delete from public.dependents where id = target_id;
end;
$$;

grant execute on function public.approve_dependent_league(uuid) to authenticated;
grant execute on function public.deny_dependent_league(uuid) to authenticated;
grant execute on function public.approve_dependent_baptism(uuid) to authenticated;
grant execute on function public.deny_dependent_baptism(uuid) to authenticated;
grant execute on function public.approve_dependent_confirmation(uuid) to authenticated;
grant execute on function public.deny_dependent_confirmation(uuid) to authenticated;
grant execute on function public.admin_update_dependent(uuid,text,date,uuid,uuid,boolean,boolean,gender) to authenticated;
grant execute on function public.admin_remove_dependent(uuid) to authenticated;

-- 2e. Aggregate stats (privacy-safe) -----------------------------------------------
-- Ordinary members can only SELECT their own (or their own children's) rows, but
-- the "Parish at a Glance" screens need congregation-wide counts, adults and
-- children combined. These run as security definer and return ONLY aggregate
-- counts — never names, phones, or individual rows. Every one of them is scoped
-- to the caller's own congregation, since they run as security definer and so
-- bypass RLS internally — the congregation filter has to live in the SQL body,
-- not rely on a table policy.

create or replace function public.stats_by_ward()
returns table(ward_id uuid, cnt bigint)
language sql security definer set search_path = public stable
as $$
  select ward_id, count(*) from (
    select ward_id, congregation_id from public.profiles where role = 'member'
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
    select league_id, congregation_id from public.profiles where role = 'member'
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
    select gender, congregation_id from public.profiles where role = 'member'
    union all
    select d.gender, p.congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id
  ) x
  where congregation_id = (select congregation_id from public.profiles where id = auth.uid()) and gender is not null
  group by gender;
$$;

create or replace function public.stats_sacraments()
returns table(total bigint, baptised bigint, confirmed bigint, adults bigint, children bigint)
language sql security definer set search_path = public stable
as $$
  -- Adult vs child is based on actual age from date_of_birth, not on whether
  -- someone's a profiles row (has their own login) or a dependents row (added
  -- by a guardian) — those are about who manages the record, not how old
  -- someone is. Falls back to the table-based guess only when birthdate is
  -- unknown (it's optional at registration).
  with people as (
    select baptised, confirmed, date_of_birth, false as fallback_is_child, congregation_id
    from public.profiles where role = 'member'
    union all
    select d.baptised, d.confirmed, d.date_of_birth, true as fallback_is_child, p.congregation_id
    from public.dependents d join public.profiles p on p.id = d.guardian_id
  ),
  classified as (
    select
      baptised, confirmed,
      case
        when date_of_birth is not null then extract(year from age(current_date, date_of_birth)) < 18
        else fallback_is_child
      end as is_child
    from people
    where congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  )
  select
    count(*),
    count(*) filter (where baptised),
    count(*) filter (where confirmed),
    count(*) filter (where not is_child),
    count(*) filter (where is_child)
  from classified;
$$;

-- Upcoming birthdays within the caller's own congregation (adults + children),
-- visible to every signed-in member — matching the common practice of
-- announcing birthdays in service. Only name/date/ward_id are returned,
-- nothing else; the frontend resolves the ward's display name/color from the
-- wards list it already has, rather than this function denormalizing it.
create or replace function public.upcoming_birthdays(days_ahead int default 30)
returns table(full_name text, date_of_birth date, is_child boolean, ward_id uuid, next_birthday date)
language sql security definer set search_path = public stable
as $$
  -- Adult vs child (for the 👶 marker) is based on actual age from
  -- date_of_birth, not on which table the record came from — see
  -- stats_sacraments() above for the same reasoning.
  with people as (
    select full_name, date_of_birth, ward_id
    from public.profiles where role = 'member' and date_of_birth is not null
      and congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    union all
    select d.full_name, d.date_of_birth, d.ward_id
    from public.dependents d join public.profiles p on p.id = d.guardian_id
    where d.date_of_birth is not null and p.congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  ),
  next_bday as (
    select
      full_name, date_of_birth, ward_id,
      extract(year from age(current_date, date_of_birth)) < 18 as is_child,
      make_date(
        extract(year from current_date)::int
          + case when make_date(extract(year from current_date)::int, extract(month from date_of_birth)::int,
                    least(extract(day from date_of_birth)::int, 28)) < current_date then 1 else 0 end,
        extract(month from date_of_birth)::int,
        least(extract(day from date_of_birth)::int, 28)
      ) as next_birthday
    from people
  )
  select full_name, date_of_birth, is_child, ward_id, next_birthday
  from next_bday
  where next_birthday <= current_date + (days_ahead || ' days')::interval
  order by next_birthday;
$$;

grant execute on function public.stats_by_ward() to authenticated;
grant execute on function public.stats_by_league() to authenticated;
grant execute on function public.stats_by_gender() to authenticated;
grant execute on function public.stats_sacraments() to authenticated;
grant execute on function public.upcoming_birthdays(int) to authenticated;

-- 3. Announcements ---------------------------------------------------------

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  title text not null,
  date_text text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.announcements enable row level security;

drop policy if exists "announcements: read" on public.announcements;
create policy "announcements: read" on public.announcements
  for select using (congregation_id = (select congregation_id from public.profiles where id = auth.uid()));

drop policy if exists "announcements: admin insert" on public.announcements;
create policy "announcements: admin insert" on public.announcements
  for insert with check (
    public.is_admin_of(congregation_id)
    and congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  );

drop policy if exists "announcements: admin update" on public.announcements;
create policy "announcements: admin update" on public.announcements
  for update using (public.is_admin_of(congregation_id));

drop policy if exists "announcements: admin delete" on public.announcements;
create policy "announcements: admin delete" on public.announcements
  for delete using (public.is_admin_of(congregation_id));

grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;

-- 4. Pre-auth congregation lookup (used by the registration screen, before a
-- profile — or even an auth.users row — exists) --------------------------------
-- Deliberately narrow: each RPC only ever returns ONE congregation's rows (the
-- one the caller asked for by id/slug), never every tenant's, so granting
-- these to `anon` doesn't expose the full multi-tenant table contents the way
-- a blanket `anon` SELECT grant on congregations/wards/leagues would.

create or replace function public.get_congregation_by_slug(p_slug text)
returns table(id uuid, name text, address text, tagline text)
language sql security definer set search_path = public stable
as $$
  select id, name, address, tagline from public.congregations where slug = p_slug;
$$;

create or replace function public.get_wards_for_congregation(p_congregation_id uuid)
returns table(id uuid, name text, color text, bank_code int)
language sql security definer set search_path = public stable
as $$
  select id, name, color, bank_code from public.wards where congregation_id = p_congregation_id order by name;
$$;

create or replace function public.get_leagues_for_congregation(p_congregation_id uuid)
returns table(id uuid, key text, label text, info text, color text, has_badge boolean)
language sql security definer set search_path = public stable
as $$
  select id, key, label, info, color, has_badge from public.leagues where congregation_id = p_congregation_id order by label;
$$;

grant execute on function public.get_congregation_by_slug(text) to anon, authenticated;
grant execute on function public.get_wards_for_congregation(uuid) to anon, authenticated;
grant execute on function public.get_leagues_for_congregation(uuid) to anon, authenticated;

-- 5. Seed TCP as tenant #1 -------------------------------------------------
-- "ELCSA Tshwane City Parish" becomes an ordinary congregation row (not a
-- special case in the code), seeded with the wards/leagues that used to be
-- hardcoded in theme.ts. `on conflict do nothing` on each keeps this section
-- safe to rerun.

insert into public.congregations (name, slug, tagline)
values ('ELCSA Tshwane City Parish', 'tshwane-city-parish', 'Evangelical Lutheran Church in Southern Africa')
on conflict (slug) do nothing;

insert into public.wards (congregation_id, name, bank_code, color)
select c.id, w.name, w.bank_code, w.color
from public.congregations c
cross join (values
  ('North', 100, '#1c4906'),
  ('East', 200, '#1565c0'),
  ('Central', 300, '#c9a227'),
  ('West', 400, '#00695c'),
  ('South', 500, '#7b1fa2')
) as w(name, bank_code, color)
where c.slug = 'tshwane-city-parish'
on conflict (congregation_id, name) do nothing;

-- No "None" row here — league_id is nullable and null already fully means
-- "no league", so a placeholder row would just be dead data every frontend
-- picker would have to filter back out.
insert into public.leagues (congregation_id, key, label, info, color, has_badge)
select c.id, l.key, l.label, l.info, l.color, l.has_badge
from public.congregations c
cross join (values
  ('PrayerMens', 'Prayer Men''s League', 'Meets Sundays 8H00. Contact Ntate Lufuno Tshikovhi, 082 638 1883', '#d71b39', true),
  ('PrayerWomens', 'Prayer Women''s League', 'Meets Sundays 8H00. Contact Mme Matshidiso Mogoase, 072 182 0472', '#ad1457', true),
  ('PrayerYouth', 'Prayer Youth League', 'Meets Sundays 8H00. Contact Vhukhudo Makuya, 079 592 3835', '#e65100', true),
  ('YoungAdults', 'Young Adults League', 'Every 2nd Monday 18H00. Contact Sis Kholo Rabotho, 082 577 1709', '#4b6fb6', true),
  ('SundaySchool', 'Sunday School', 'For children. Ask at the Secretariat Desk', '#00897b', false),
  ('ConfirmationClass', 'Confirmation Class', 'Preparation classes ahead of Confirmation', '#5d4037', false),
  ('ELCSAMO', 'ELCSAMO (Music Organisation)', 'Sun after church, Thu 18H00, Sat 14H00. Contact Mr Azwi Ramakuela', '#1b245f', true),
  ('ELCSASO', 'ELCSASO (Student Organisation)', 'UP / TUT / Eduvos chapters. Ask at the Secretariat Desk', '#2e7d32', false),
  ('DiaconateMinistry', 'Diaconate Ministry', 'Serve, Care, Give Hope. Outreach and donations ministry', '#37474f', false)
) as l(key, label, info, color, has_badge)
where c.slug = 'tshwane-city-parish'
on conflict (congregation_id, key) do nothing;

-- 6. First admin -------------------------------------------------------
-- Register a normal account through the app first, then promote it to admin by
-- running this (find the id in Authentication > Users in the Supabase dashboard):
--   update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
