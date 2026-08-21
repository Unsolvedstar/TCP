-- League admins can now choose the audience for what they post: just their
-- own league, or the whole church (congregation-wide, league_id = null) —
-- previously only congregation admins could post congregation-wide.

create or replace function public.is_any_league_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.league_admins where profile_id = auth.uid());
$$;

grant execute on function public.is_any_league_admin() to authenticated;

-- created_by now defaults to the poster automatically, so the update/delete
-- "did I create this church-wide post" check below is reliable even if a
-- client insert forgets to pass it explicitly.
alter table public.announcements alter column created_by set default auth.uid();
alter table public.events alter column created_by set default auth.uid();

drop policy if exists "announcements: admin insert" on public.announcements;
create policy "announcements: admin insert" on public.announcements
  for insert with check (
    congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    and public.league_belongs_to(league_id, congregation_id)
    and (
      public.is_admin_of(congregation_id)
      or (league_id is not null and public.is_league_admin_of(league_id))
      or (league_id is null and public.is_any_league_admin())
    )
  );

drop policy if exists "announcements: admin update" on public.announcements;
create policy "announcements: admin update" on public.announcements
  for update using (
    public.is_admin_of(congregation_id)
    or (league_id is not null and public.is_league_admin_of(league_id))
    or (league_id is null and created_by = auth.uid())
  );

drop policy if exists "announcements: admin delete" on public.announcements;
create policy "announcements: admin delete" on public.announcements
  for delete using (
    public.is_admin_of(congregation_id)
    or (league_id is not null and public.is_league_admin_of(league_id))
    or (league_id is null and created_by = auth.uid())
  );

drop policy if exists "events: admin insert" on public.events;
create policy "events: admin insert" on public.events
  for insert with check (
    congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    and public.league_belongs_to(league_id, congregation_id)
    and (
      public.is_admin_of(congregation_id)
      or (league_id is not null and public.is_league_admin_of(league_id))
      or (league_id is null and public.is_any_league_admin())
    )
  );

drop policy if exists "events: admin update" on public.events;
create policy "events: admin update" on public.events
  for update using (
    public.is_admin_of(congregation_id)
    or (league_id is not null and public.is_league_admin_of(league_id))
    or (league_id is null and created_by = auth.uid())
  );

drop policy if exists "events: admin delete" on public.events;
create policy "events: admin delete" on public.events
  for delete using (
    public.is_admin_of(congregation_id)
    or (league_id is not null and public.is_league_admin_of(league_id))
    or (league_id is null and created_by = auth.uid())
  );
