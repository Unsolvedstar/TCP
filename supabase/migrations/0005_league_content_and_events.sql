-- Announcements gain optional league scoping (null = congregation-wide,
-- unchanged behavior), and a new events table for a real calendar grid and
-- league-run event listings.

alter table public.announcements add column if not exists league_id uuid references public.leagues(id);

drop policy if exists "announcements: admin insert" on public.announcements;
create policy "announcements: admin insert" on public.announcements
  for insert with check (
    congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    and public.league_belongs_to(league_id, congregation_id)
    and (public.is_admin_of(congregation_id) or (league_id is not null and public.is_league_admin_of(league_id)))
  );

drop policy if exists "announcements: admin update" on public.announcements;
create policy "announcements: admin update" on public.announcements
  for update using (public.is_admin_of(congregation_id) or (league_id is not null and public.is_league_admin_of(league_id)));

drop policy if exists "announcements: admin delete" on public.announcements;
create policy "announcements: admin delete" on public.announcements
  for delete using (public.is_admin_of(congregation_id) or (league_id is not null and public.is_league_admin_of(league_id)));
-- "announcements: read" is unchanged: any congregation member reads every
-- congregation announcement, league-scoped or not — per-member "my league
-- only" filtering happens client-side, not via RLS.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  league_id uuid references public.leagues(id), -- null = congregation-wide
  title text not null,
  event_date date not null,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

alter table public.events enable row level security;

drop policy if exists "events: read" on public.events;
create policy "events: read" on public.events
  for select using (congregation_id = (select congregation_id from public.profiles where id = auth.uid()));

drop policy if exists "events: admin insert" on public.events;
create policy "events: admin insert" on public.events
  for insert with check (
    congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    and public.league_belongs_to(league_id, congregation_id)
    and (public.is_admin_of(congregation_id) or (league_id is not null and public.is_league_admin_of(league_id)))
  );

drop policy if exists "events: admin update" on public.events;
create policy "events: admin update" on public.events
  for update using (public.is_admin_of(congregation_id) or (league_id is not null and public.is_league_admin_of(league_id)));

drop policy if exists "events: admin delete" on public.events;
create policy "events: admin delete" on public.events
  for delete using (public.is_admin_of(congregation_id) or (league_id is not null and public.is_league_admin_of(league_id)));

grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;

-- Calendar-grid birthday lookup for an arbitrary displayed month (not "next
-- N days" like upcoming_birthdays() — the grid must answer "who's born in
-- June" regardless of navigation direction). Same privacy-safe/own-
-- congregation-only shape and Feb-29-clamped-to-28 day-of-month logic.
create or replace function public.birthdays_for_month(p_month_start date)
returns table(full_name text, date_of_birth date, is_child boolean, ward_id uuid, day_of_month int)
language sql security definer set search_path = public stable
as $$
  with people as (
    select full_name, date_of_birth, ward_id from public.profiles
    where role = 'member' and date_of_birth is not null
      and congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    union all
    select d.full_name, d.date_of_birth, d.ward_id from public.dependents d join public.profiles p on p.id = d.guardian_id
    where d.date_of_birth is not null and p.congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  )
  select full_name, date_of_birth, extract(year from age(current_date, date_of_birth)) < 18, ward_id,
    least(extract(day from date_of_birth)::int, 28)
  from people
  where extract(month from date_of_birth) = extract(month from p_month_start);
$$;

grant execute on function public.birthdays_for_month(date) to authenticated;
