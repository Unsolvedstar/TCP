-- ELCSA Tshwane City Parish — core schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) on a fresh project.

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

-- 2. Profiles ------------------------------------------------------------
-- One row per auth.users row. Created automatically on sign-up (trigger below).

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  ward ward not null,
  role app_role not null default 'member',
  league league not null default 'None',
  baptised boolean not null default false,
  confirmed boolean not null default false,
  pending_league league,
  pending_baptism boolean not null default false,
  pending_confirmation boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: is the current user an admin? (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Members can read/update their own profile. Admins can read/update everyone's.
create policy "profiles: self select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles: self update" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- Only the sign-up trigger (running as postgres) inserts rows; block direct client inserts.
create policy "profiles: admin insert" on public.profiles
  for insert with check (public.is_admin());

create policy "profiles: admin delete" on public.profiles
  for delete using (public.is_admin());

-- Auto-create a profile row when someone signs up via Supabase Auth.
-- Full name / ward are passed in as auth signUp() "data" (user_metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, ward)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'ward')::ward, 'Central')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

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

create policy "announcements: read all" on public.announcements
  for select using (true);

create policy "announcements: admin write" on public.announcements
  for insert with check (public.is_admin());

create policy "announcements: admin update" on public.announcements
  for update using (public.is_admin());

create policy "announcements: admin delete" on public.announcements
  for delete using (public.is_admin());

-- 4. First admin -------------------------------------------------------
-- After your first real sign-up, promote yourself to admin by running:
--   update public.profiles set role = 'admin' where id = '<your-auth-user-id>';
-- (Find the id in Authentication > Users in the Supabase dashboard.)
