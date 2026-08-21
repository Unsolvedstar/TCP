-- League-vs-league leaderboard. Points come from two sources: automatic
-- triggers on concrete in-app actions (posting league content, an approved
-- join), and manual congregation-admin awards for real-world/offline
-- activity that can't be auto-detected (a community outreach day, hosting a
-- youth camp, etc.) — each with a required reason for the audit trail.

create table if not exists public.league_points (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  points int not null,
  reason text not null,
  source text not null default 'manual', -- 'manual' | 'announcement_posted' | 'event_posted' | 'join_approved'
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.league_points enable row level security;

-- Ledger detail (the "reason" audit trail) is admin-only; everyone sees only
-- the aggregate via league_leaderboard() below — same "aggregate is public,
-- rows are protected" split the stats_by_* RPCs already use.
drop policy if exists "league_points: admin select" on public.league_points;
create policy "league_points: admin select" on public.league_points
  for select using (public.is_admin_of(congregation_id));

-- Manual awards are congregation-admin only — not league admins, who could
-- otherwise just award their own league points.
drop policy if exists "league_points: admin manual insert" on public.league_points;
create policy "league_points: admin manual insert" on public.league_points
  for insert with check (
    source = 'manual'
    and public.is_admin_of(congregation_id)
    and public.league_belongs_to(league_id, congregation_id)
  );
-- No update/delete grant — append-only ledger. A mistaken award is
-- corrected with a new negative-point row and its own reason, not an edit.

grant select, insert on public.league_points to authenticated;
grant all on public.league_points to service_role;

create or replace function public.admin_award_league_points(target_league_id uuid, p_points int, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.leagues where id = target_league_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if p_reason is null or length(trim(p_reason)) = 0 then raise exception 'A reason is required.'; end if;
  insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
  values (target_congregation_id, target_league_id, p_points, trim(p_reason), 'manual', auth.uid());
end;
$$;

-- Public totals — every signed-in member can see the leaderboard; only
-- admins can see *why* via the league_points SELECT policy above. Scoped to
-- the caller's own congregation, same pattern as stats_by_league().
create or replace function public.league_leaderboard()
returns table(league_id uuid, total_points bigint)
language sql security definer set search_path = public stable
as $$
  select league_id, coalesce(sum(points), 0) from public.league_points
  where congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  group by league_id;
$$;

grant execute on function public.admin_award_league_points(uuid, int, text) to authenticated;
grant execute on function public.league_leaderboard() to authenticated;

-- Automatic points: posting league-scoped content earns that league points,
-- regardless of who posted it (a congregation admin posting on a league's
-- behalf still counts as "the league did something").
create or replace function public.award_points_for_league_content()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.league_id is not null then
    insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
    values (
      new.congregation_id, new.league_id, 2,
      case when tg_table_name = 'announcements' then 'Posted an announcement: ' || new.title else 'Posted an event: ' || new.title end,
      case when tg_table_name = 'announcements' then 'announcement_posted' else 'event_posted' end,
      new.created_by
    );
  end if;
  return new;
end;
$$;

create or replace trigger announcements_award_points
  after insert on public.announcements
  for each row execute function public.award_points_for_league_content();

create or replace trigger events_award_points
  after insert on public.events
  for each row execute function public.award_points_for_league_content();

-- Points for an approved join, layered onto 0004_league_admins.sql's
-- approve_league/approve_dependent_league (a further create-or-replace,
-- never editing an already-applied migration in place).
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
  if target_pending_league_id is not null then
    insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
    values (target_congregation_id, target_pending_league_id, 5, 'New member approved: ' || (select full_name from public.profiles where id = target_id), 'join_approved', auth.uid());
  end if;
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
  if target_pending_league_id is not null then
    insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
    values (target_congregation_id, target_pending_league_id, 5, 'New member approved: ' || (select full_name from public.dependents where id = target_id), 'join_approved', auth.uid());
  end if;
end;
$$;
