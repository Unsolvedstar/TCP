-- Remove the league points / leaderboard gamification feature ---------------
-- Leagues themselves (membership, league admins, league-scoped content)
-- stay exactly as they are; only the point-scoring layer on top goes away:
-- no more auto-awarded points for posting content or an approved join, no
-- more manual admin awards, no more leaderboard. approve_league/
-- approve_dependent_league/confirm_ceremony_date keep doing everything else
-- they did (finalizing the request, persisting detail, creating the
-- calendar entry) — only the `insert into league_points` step is removed.

drop trigger if exists announcements_award_points on public.announcements;
drop trigger if exists events_award_points on public.events;
drop function if exists public.award_points_for_league_content();

drop function if exists public.admin_award_league_points(uuid, int, text);
drop function if exists public.league_leaderboard();

-- Re-declared from 0020, minus the league_points insert.
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
    set league_id = pending_league_id, pending_league_id = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = target_id;
end;
$$;

-- Re-declared from 0020, minus the league_points insert.
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
    set league_id = pending_league_id, pending_league_id = null, reviewed_by = auth.uid(), reviewed_at = now()
    where id = target_id;
end;
$$;

-- Re-declared from 0020, minus the league_points insert in the 'league' branch.
create or replace function public.confirm_ceremony_date(proposal_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  prop record;
  is_owner boolean;
  league_label text;
  event_title text;
  existing_event_id uuid;
begin
  select * into prop from public.ceremony_proposals where id = proposal_id;
  if prop is null then raise exception 'Not found.'; end if;
  if prop.status <> 'proposed' then raise exception 'This has already been responded to.'; end if;

  is_owner := (prop.subject_profile_id is not null and prop.subject_profile_id = auth.uid())
    or (prop.subject_dependent_id is not null and exists(select 1 from public.dependents where id = prop.subject_dependent_id and guardian_id = auth.uid()));
  if not is_owner then raise exception 'not authorized'; end if;

  if prop.kind = 'baptism' then
    if prop.subject_profile_id is not null then
      update public.profiles set baptised = true, pending_baptism = false, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_profile_id;
    else
      update public.dependents set baptised = true, pending_baptism = false, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_dependent_id;
    end if;
    event_title := 'Baptism';
  elsif prop.kind = 'confirmation' then
    if prop.subject_profile_id is not null then
      update public.profiles set confirmed = true, pending_confirmation = false, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_profile_id;
    else
      update public.dependents set confirmed = true, pending_confirmation = false, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_dependent_id;
    end if;
    event_title := 'Confirmation';
  else
    select label into league_label from public.leagues where id = prop.league_id;
    if prop.subject_profile_id is not null then
      update public.profiles set league_id = prop.league_id, pending_league_id = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_profile_id;
    else
      update public.dependents set league_id = prop.league_id, pending_league_id = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_dependent_id;
    end if;
    event_title := league_label || ' Installation';
  end if;

  select id into existing_event_id from public.events
    where congregation_id = prop.congregation_id and event_date = prop.ceremony_date and title = event_title
      and league_id is not distinct from prop.league_id
    limit 1;
  if existing_event_id is null then
    insert into public.events (congregation_id, league_id, title, event_date, created_by, source)
    values (prop.congregation_id, prop.league_id, event_title, prop.ceremony_date, prop.proposed_by, 'ceremony');
  end if;

  update public.ceremony_proposals set status = 'confirmed', responded_at = now() where id = proposal_id;
end;
$$;

drop table if exists public.league_points;
