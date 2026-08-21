-- League admins: a member can be granted admin rights scoped to a single
-- league (announcements, events, and join approvals for that league only —
-- not general member management, and not visibility into other leagues).

create table if not exists public.league_admins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, league_id)
);

alter table public.league_admins enable row level security;

-- Defense in depth: the assigned profile and the league must belong to the
-- same congregation. A trigger, not a check constraint, since this needs
-- cross-table lookups.
create or replace function public.league_admins_same_congregation()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  profile_congregation_id uuid;
  league_congregation_id uuid;
begin
  select congregation_id into profile_congregation_id from public.profiles where id = new.profile_id;
  select congregation_id into league_congregation_id from public.leagues where id = new.league_id;
  if profile_congregation_id is null or profile_congregation_id != league_congregation_id then
    raise exception 'League admin and league must belong to the same congregation.';
  end if;
  return new;
end;
$$;

create or replace trigger league_admins_congregation_check
  before insert or update on public.league_admins
  for each row execute function public.league_admins_same_congregation();

drop policy if exists "league_admins: select" on public.league_admins;
create policy "league_admins: select" on public.league_admins
  for select using (
    profile_id = auth.uid()
    or public.is_admin_of((select congregation_id from public.profiles where id = league_admins.profile_id))
  );

grant select on public.league_admins to authenticated;
grant all on public.league_admins to service_role;
-- No insert/update/delete grants for authenticated — mutated only via
-- admin_set_league_admin() below, same convention as profiles/dependents.

create or replace function public.is_league_admin_of(p_league_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.league_admins where profile_id = auth.uid() and league_id = p_league_id);
$$;

create or replace function public.admin_set_league_admin(target_profile_id uuid, target_league_id uuid, make_admin boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_profile_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if not public.league_belongs_to(target_league_id, target_congregation_id) then raise exception 'Invalid league.'; end if;
  if make_admin then
    insert into public.league_admins (profile_id, league_id) values (target_profile_id, target_league_id) on conflict do nothing;
  else
    delete from public.league_admins where profile_id = target_profile_id and league_id = target_league_id;
  end if;
end;
$$;

grant execute on function public.admin_set_league_admin(uuid, uuid, boolean) to authenticated;

-- Narrow profiles/dependents SELECT so a league admin can see pending join
-- requests for their own league only, not the whole roster. is_league_admin_of(null)
-- is false (no row has league_id = null), so this is a no-op for anyone
-- without a pending league request on that row.
drop policy if exists "profiles: select" on public.profiles;
create policy "profiles: select" on public.profiles
  for select using (
    auth.uid() = id
    or public.is_admin_of(congregation_id)
    or public.is_league_admin_of(profiles.pending_league_id)
  );

drop policy if exists "dependents: select" on public.dependents;
create policy "dependents: select" on public.dependents
  for select using (
    guardian_id = auth.uid()
    or public.is_admin_of((select congregation_id from public.profiles where id = dependents.guardian_id))
    or public.is_league_admin_of(dependents.pending_league_id)
  );

-- League-join approve/deny now also accept a league admin of the specific
-- pending league, alongside congregation admins. Re-declared here in full
-- (create or replace) rather than editing 0001_init.sql in place.
create or replace function public.approve_league(target_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  target_congregation_id uuid;
  target_pending_league_id uuid;
begin
  select congregation_id, pending_league_id into target_congregation_id, target_pending_league_id
    from public.profiles where id = target_id;
  if not (
    public.is_admin_of(target_congregation_id)
    or (target_pending_league_id is not null and public.is_league_admin_of(target_pending_league_id))
  ) then
    raise exception 'not authorized';
  end if;
  if not public.league_belongs_to(target_pending_league_id, target_congregation_id) then
    raise exception 'Pending league does not belong to this congregation.';
  end if;
  update public.profiles
    set league_id = pending_league_id, pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = target_id;
end;
$$;

create or replace function public.deny_league(target_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  target_congregation_id uuid;
  target_pending_league_id uuid;
begin
  select congregation_id, pending_league_id into target_congregation_id, target_pending_league_id
    from public.profiles where id = target_id;
  if not (
    public.is_admin_of(target_congregation_id)
    or (target_pending_league_id is not null and public.is_league_admin_of(target_pending_league_id))
  ) then
    raise exception 'not authorized';
  end if;
  update public.profiles
    set pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = target_id;
end;
$$;

create or replace function public.approve_dependent_league(target_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  target_congregation_id uuid;
  target_pending_league_id uuid;
begin
  select p.congregation_id, d.pending_league_id into target_congregation_id, target_pending_league_id
    from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not (
    public.is_admin_of(target_congregation_id)
    or (target_pending_league_id is not null and public.is_league_admin_of(target_pending_league_id))
  ) then
    raise exception 'not authorized';
  end if;
  if not public.league_belongs_to(target_pending_league_id, target_congregation_id) then
    raise exception 'Pending league does not belong to this congregation.';
  end if;
  update public.dependents
    set league_id = pending_league_id, pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = target_id;
end;
$$;

create or replace function public.deny_dependent_league(target_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  target_congregation_id uuid;
  target_pending_league_id uuid;
begin
  select p.congregation_id, d.pending_league_id into target_congregation_id, target_pending_league_id
    from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not (
    public.is_admin_of(target_congregation_id)
    or (target_pending_league_id is not null and public.is_league_admin_of(target_pending_league_id))
  ) then
    raise exception 'not authorized';
  end if;
  update public.dependents
    set pending_league_id = null, league_application = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = target_id;
end;
$$;
