-- ELCSA Tshwane City Parish — core schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) on a fresh project.
--
-- Design note: every WRITE to `profiles` (besides your own phone number and the
-- pending_* "request" flags) goes through a security-definer RPC function that
-- checks authorization itself. This means table-level UPDATE is never granted
-- directly to app users — so a member can never set their own `role`, `baptised`,
-- `confirmed` or someone else's data by crafting a raw update, no matter what the
-- client-side app code does. All the actual security lives here, in Postgres.

-- 1. Enums -------------------------------------------------------------

create type ward as enum ('North','East','Central','West','South');

create type league as enum (
  'None',
  'PrayerMens',
  'PrayerWomens',
  'PrayerYouth',
  'YoungAdults',
  'SundaySchool',
  'ConfirmationClass',
  'ELCSAMO',
  'ELCSASO',
  'DiaconateMinistry'
);

create type app_role as enum ('member','admin');

create type gender as enum ('Male','Female');

-- 2. Profiles ------------------------------------------------------------
-- One row per auth.users row, created automatically on sign-up (trigger below).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  date_of_birth date,
  gender gender,
  ward ward not null,
  role app_role not null default 'member',
  league league not null default 'None',
  baptised boolean not null default false,
  confirmed boolean not null default false,
  pending_league league,
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

-- Read access: your own row, or every row if you're an admin.
-- (Congregation-wide chart data for ordinary members comes from the anonymised
-- stats_* functions below, not from reading other people's profile rows.)
create policy "profiles: select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

grant select on public.profiles to authenticated;

-- No insert/update/delete grants for profiles at all — every mutation below
-- happens inside a security-definer function that runs with elevated rights and
-- does its own authorization check, so no RLS/grant policy is required or relied on.

-- Auto-create a profile row when someone signs up via Supabase Auth.
-- Full name / phone / ward are passed in as auth signUp() "data" (user_metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  claims_baptised boolean := coalesce((new.raw_user_meta_data->>'already_baptised')::boolean, false);
  claims_confirmed boolean := coalesce((new.raw_user_meta_data->>'already_confirmed')::boolean, false) and claims_baptised;
  claims_league league := nullif(nullif(new.raw_user_meta_data->>'initial_league', ''), 'None')::league;
begin
  -- What someone types at sign-up is a claim, not a fact: baptism/confirmation/league
  -- are only ever recorded as *pending* here, exactly like requesting them later from
  -- the portal would — an admin still has to confirm them before they count. This is
  -- just collecting the claim (and the same sponsor/reason/signature questions the
  -- portal's request forms ask) once, up front, instead of making them ask again
  -- after registering. Confirmation without also claiming baptism is nonsensical, so
  -- it's dropped rather than trusted.
  insert into public.profiles (
    id, full_name, phone, date_of_birth, gender, ward,
    pending_league, pending_baptism, pending_confirmation,
    league_application, baptism_application, confirmation_application
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'gender', '')::gender,
    coalesce((new.raw_user_meta_data->>'ward')::ward, 'Central'),
    claims_league,
    claims_baptised,
    claims_confirmed,
    case when claims_league is null then null else
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

create trigger on_auth_user_created
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
  new_league league, p_reason text default null, p_signature text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set
    pending_league = new_league,
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
  update public.profiles set pending_league = null, league_application = null where id = auth.uid();
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
grant execute on function public.request_league(league, text, text, text, text) to authenticated;
grant execute on function public.cancel_league_request() to authenticated;
grant execute on function public.request_baptism(text, text, text, text) to authenticated;
grant execute on function public.cancel_baptism_request() to authenticated;
grant execute on function public.request_confirmation(text, text, text, text) to authenticated;
grant execute on function public.cancel_confirmation_request() to authenticated;

-- 2b. Admin actions (every function below checks is_admin() itself) ---------------

create or replace function public.approve_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set league = pending_league, pending_league = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set pending_league = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set baptised = true, pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set confirmed = true, pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

-- Admin edits any member's core fields (used by the Members screen's edit form).
create or replace function public.admin_update_member(
  target_id uuid, p_full_name text, p_phone text, p_ward ward,
  p_league league, p_baptised boolean, p_confirmed boolean,
  p_date_of_birth date default null, p_gender gender default null
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set
    full_name = p_full_name, phone = p_phone, ward = p_ward,
    league = p_league, baptised = p_baptised, confirmed = p_confirmed,
    date_of_birth = p_date_of_birth, gender = p_gender
  where id = target_id;
end;
$$;

-- Promote/demote admin access. Guard against removing the last remaining admin.
create or replace function public.admin_set_role(target_id uuid, new_role app_role)
returns void language plpgsql security definer set search_path = public
as $$
declare admin_count int;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if new_role = 'member' then
    select count(*) into admin_count from public.profiles where role = 'admin';
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
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.profiles where id = target_id;
end;
$$;

grant execute on function public.approve_league(uuid) to authenticated;
grant execute on function public.deny_league(uuid) to authenticated;
grant execute on function public.approve_baptism(uuid) to authenticated;
grant execute on function public.deny_baptism(uuid) to authenticated;
grant execute on function public.approve_confirmation(uuid) to authenticated;
grant execute on function public.deny_confirmation(uuid) to authenticated;
grant execute on function public.admin_update_member(uuid,text,text,ward,league,boolean,boolean,date,gender) to authenticated;
grant execute on function public.admin_set_role(uuid, app_role) to authenticated;
grant execute on function public.admin_remove_member(uuid) to authenticated;

-- 2c. Dependents (children who don't have their own phone/account) ---------------
-- Owned by a "guardian" profile. No login of their own — the guardian (or an
-- admin) manages their record and requests on their behalf.

create table public.dependents (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  gender gender,
  ward ward not null,
  league league not null default 'None',
  baptised boolean not null default false,
  confirmed boolean not null default false,
  pending_league league,
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

create policy "dependents: select" on public.dependents
  for select using (guardian_id = auth.uid() or public.is_admin());

grant select on public.dependents to authenticated;
-- Same pattern as profiles: no direct insert/update/delete grants — every
-- mutation goes through a security-definer function that checks ownership itself.

create or replace function public.add_dependent(
  p_full_name text, p_date_of_birth date, p_ward ward, p_gender gender default null,
  p_initial_league league default null, p_already_baptised boolean default false, p_already_confirmed boolean default false,
  p_baptism_type text default null, p_sponsor_name text default null, p_mentor_name text default null,
  p_league_reason text default null, p_signature text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  claims_baptised boolean := coalesce(p_already_baptised, false);
  claims_confirmed boolean := coalesce(p_already_confirmed, false) and claims_baptised;
  claims_league league := case when p_initial_league = 'None' then null else p_initial_league end;
begin
  -- Same rule as new adult sign-ups: what a guardian claims here goes on as a
  -- *pending* request, not a fact — an admin still has to confirm it.
  insert into public.dependents (
    guardian_id, full_name, date_of_birth, ward, gender,
    pending_league, pending_baptism, pending_confirmation,
    league_application, baptism_application, confirmation_application
  )
  values (
    auth.uid(), p_full_name, p_date_of_birth, p_ward, p_gender,
    claims_league, claims_baptised, claims_confirmed,
    case when claims_league is null then null else
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

create or replace function public.update_my_dependent(target_id uuid, p_full_name text, p_date_of_birth date, p_ward ward, p_gender gender default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.dependents set full_name = p_full_name, date_of_birth = p_date_of_birth, ward = p_ward, gender = p_gender where id = target_id;
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
  target_id uuid, new_league league, p_reason text default null, p_signature text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.dependents set
    pending_league = new_league,
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
  update public.dependents set pending_league = null, league_application = null where id = target_id and guardian_id = auth.uid();
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

grant execute on function public.add_dependent(text, date, ward, gender, league, boolean, boolean, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.update_my_dependent(uuid, text, date, ward, gender) to authenticated;
grant execute on function public.remove_my_dependent(uuid) to authenticated;
grant execute on function public.request_dependent_league(uuid, league, text, text, text, text) to authenticated;
grant execute on function public.cancel_dependent_league_request(uuid) to authenticated;
grant execute on function public.request_dependent_baptism(uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_dependent_baptism_request(uuid) to authenticated;
grant execute on function public.request_dependent_confirmation(uuid, text, text, text, text) to authenticated;
grant execute on function public.cancel_dependent_confirmation_request(uuid) to authenticated;

-- 2d. Admin actions on dependents (mirrors 2b for profiles) -----------------------

create or replace function public.approve_dependent_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.dependents set league = pending_league, pending_league = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_dependent_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.dependents set pending_league = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_dependent_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.dependents set baptised = true, pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_dependent_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.dependents set pending_baptism = false, baptism_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_dependent_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.dependents set confirmed = true, pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.deny_dependent_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.dependents set pending_confirmation = false, confirmation_application = null, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.admin_update_dependent(
  target_id uuid, p_full_name text, p_date_of_birth date, p_ward ward,
  p_league league, p_baptised boolean, p_confirmed boolean, p_gender gender default null
) returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.dependents set
    full_name = p_full_name, date_of_birth = p_date_of_birth, ward = p_ward,
    league = p_league, baptised = p_baptised, confirmed = p_confirmed, gender = p_gender
  where id = target_id;
end;
$$;

create or replace function public.admin_remove_dependent(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  delete from public.dependents where id = target_id;
end;
$$;

grant execute on function public.approve_dependent_league(uuid) to authenticated;
grant execute on function public.deny_dependent_league(uuid) to authenticated;
grant execute on function public.approve_dependent_baptism(uuid) to authenticated;
grant execute on function public.deny_dependent_baptism(uuid) to authenticated;
grant execute on function public.approve_dependent_confirmation(uuid) to authenticated;
grant execute on function public.deny_dependent_confirmation(uuid) to authenticated;
grant execute on function public.admin_update_dependent(uuid,text,date,ward,league,boolean,boolean,gender) to authenticated;
grant execute on function public.admin_remove_dependent(uuid) to authenticated;

-- 2e. Aggregate stats (privacy-safe) -----------------------------------------------
-- Ordinary members can only SELECT their own (or their own children's) rows, but
-- the "Parish at a Glance" screens need congregation-wide counts, adults and
-- children combined. These run as security definer and return ONLY aggregate
-- counts — never names, phones, or individual rows.

create or replace function public.stats_by_ward()
returns table(ward ward, cnt bigint)
language sql security definer set search_path = public stable
as $$
  select ward, count(*) from (
    select ward from public.profiles where role = 'member'
    union all
    select ward from public.dependents
  ) x group by ward;
$$;

create or replace function public.stats_by_league()
returns table(league league, cnt bigint)
language sql security definer set search_path = public stable
as $$
  select league, count(*) from (
    select league from public.profiles where role = 'member'
    union all
    select league from public.dependents
  ) x group by league;
$$;

create or replace function public.stats_by_gender()
returns table(gender gender, cnt bigint)
language sql security definer set search_path = public stable
as $$
  select gender, count(*) from (
    select gender from public.profiles where role = 'member'
    union all
    select gender from public.dependents
  ) x where gender is not null group by gender;
$$;

create or replace function public.stats_sacraments()
returns table(total bigint, baptised bigint, confirmed bigint, adults bigint, children bigint)
language sql security definer set search_path = public stable
as $$
  with people as (
    select baptised, confirmed, false as is_child from public.profiles where role = 'member'
    union all
    select baptised, confirmed, true as is_child from public.dependents
  )
  select
    count(*),
    count(*) filter (where baptised),
    count(*) filter (where confirmed),
    count(*) filter (where not is_child),
    count(*) filter (where is_child)
  from people;
$$;

-- Upcoming birthdays across the whole congregation (adults + children), visible to
-- every signed-in user — matching the common practice of announcing birthdays in
-- service. Only name/date/ward are returned, nothing else.
create or replace function public.upcoming_birthdays(days_ahead int default 30)
returns table(full_name text, date_of_birth date, is_child boolean, ward ward, next_birthday date)
language sql security definer set search_path = public stable
as $$
  with people as (
    select full_name, date_of_birth, false as is_child, ward
    from public.profiles where role = 'member' and date_of_birth is not null
    union all
    select full_name, date_of_birth, true as is_child, ward
    from public.dependents where date_of_birth is not null
  ),
  next_bday as (
    select
      full_name, date_of_birth, is_child, ward,
      make_date(
        extract(year from current_date)::int
          + case when make_date(extract(year from current_date)::int, extract(month from date_of_birth)::int,
                    least(extract(day from date_of_birth)::int, 28)) < current_date then 1 else 0 end,
        extract(month from date_of_birth)::int,
        least(extract(day from date_of_birth)::int, 28)
      ) as next_birthday
    from people
  )
  select full_name, date_of_birth, is_child, ward, next_birthday
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

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date_text text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.announcements enable row level security;

create policy "announcements: read" on public.announcements
  for select using (auth.uid() is not null);

create policy "announcements: admin insert" on public.announcements
  for insert with check (public.is_admin());

create policy "announcements: admin update" on public.announcements
  for update using (public.is_admin());

create policy "announcements: admin delete" on public.announcements
  for delete using (public.is_admin());

grant select, insert, update, delete on public.announcements to authenticated;

-- 4. First admin -------------------------------------------------------
-- Register a normal account through the app first, then promote it to admin by
-- running this (find the id in Authentication > Users in the Supabase dashboard):
--   update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
