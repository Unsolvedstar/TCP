-- Stop deleting sacrament/league detail the moment it's finalized ----------
-- A baptism/confirmation/league claim made at registration (already_baptised
-- etc.) keeps its sponsor/officiant/location/type detail forever — that
-- code path never clears baptism_application/confirmation_application/
-- league_application. But the same detail submitted through an actual
-- portal *request* — sponsor name, where, who officiated — was being
-- deleted in the same statement that finalizes the request: every
-- approve_baptism/approve_confirmation/approve_league (and their dependent
-- equivalents, 0001) and confirm_ceremony_date (0010) set the boolean flag
-- to true AND null out the jsonb that held the only copy of that detail, in
-- one update. So for anyone who actually went through the real
-- request-and-schedule flow (presumably most people, going forward), there
-- was nothing left to put on an eventual certificate — no sponsor, no
-- officiant, no location. Only the self-attested-at-registration group had
-- anything to show, which was never the point.
--
-- Fix: stop nulling that column on approval, full stop — the exact same
-- "leave it there forever" behavior the registration-time path already
-- has, now applied consistently everywhere a claim becomes fact. deny_* is
-- untouched: a denied request's detail was never realized as fact and
-- should still be discarded. league_application intentionally isn't
-- special-cased for "might install into another league later" — a fresh
-- request_league() call already overwrites it with new data regardless of
-- what the field held before, so leaving old detail in place between
-- installations is harmless and exactly what a "current league" certificate
-- would want to read.

-- Based on 0006's version (not 0001's — 0006 added league-admin approval
-- rights and the auto point-award, both of which must survive this fix).
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
  if target_pending_league_id is not null then
    insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
    values (target_congregation_id, target_pending_league_id, 5, 'New member approved: ' || (select full_name from public.profiles where id = target_id), 'join_approved', auth.uid());
  end if;
end;
$$;

create or replace function public.approve_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.profiles set baptised = true, pending_baptism = false, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.profiles set confirmed = true, pending_confirmation = false, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

-- Based on 0006's version, same reason as approve_league above.
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
  if target_pending_league_id is not null then
    insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
    values (target_congregation_id, target_pending_league_id, 5, 'New member approved: ' || (select full_name from public.dependents where id = target_id), 'join_approved', auth.uid());
  end if;
end;
$$;

create or replace function public.approve_dependent_baptism(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.dependents set baptised = true, pending_baptism = false, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

create or replace function public.approve_dependent_confirmation(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.dependents set confirmed = true, pending_confirmation = false, reviewed_by = auth.uid(), reviewed_at = now() where id = target_id;
end;
$$;

-- Re-declared in full from 0010_ceremony_scheduling.sql — same fix, applied
-- to the path the app actually uses today (propose/confirm a date rather
-- than instant-approve). Only the three "= null" clauses on the
-- *_application columns are removed; everything else is unchanged.
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
    insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
      values (prop.congregation_id, prop.league_id, 5, 'New member installed', 'join_approved', prop.proposed_by);
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
