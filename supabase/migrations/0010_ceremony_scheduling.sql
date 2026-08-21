-- Approving a baptism/confirmation/league-installation request no longer
-- finalizes it instantly. An admin proposes a ceremony date, the member (or
-- their guardian, for a dependent) confirms it actually works for them, and
-- only then does the request finalize (same effect approve_baptism/
-- approve_confirmation/approve_league already had) AND a calendar entry
-- gets created — titled generically ("Baptism", "Confirmation", "<League>
-- Installation"), not per-person, so several people sharing the same
-- ceremony date share one calendar entry instead of duplicating it.
--
-- approve_baptism/approve_confirmation/approve_league (and their dependent
-- equivalents) are untouched and still work — this is a new, separate path
-- the client now uses instead of calling them directly for these three
-- request kinds. deny_* is unchanged too: declining a request outright is
-- still immediate, no date involved.

-- Distinguishes a calendar entry auto-created by confirm_ceremony_date from
-- an admin/league-admin manually posting one, so award_points_for_league_content
-- (0006) doesn't ALSO award the "posted an event" bonus on top of the
-- explicit "new member installed" points confirm_ceremony_date already
-- gives below — both firing would double-count one action.
alter table public.events add column if not exists source text not null default 'manual';

create or replace function public.award_points_for_league_content()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- This one function backs triggers on both announcements and events, and
  -- only `events` has a `source` column — `new.source` would raise "record
  -- new has no field source" when fired for an announcements row, since
  -- plpgsql resolves record field access at runtime regardless of which
  -- branch of the AND it's in. to_jsonb(...)->>'source' is a safe lookup
  -- that returns null instead of erroring when the key isn't there.
  if new.league_id is not null and not (tg_table_name = 'events' and (to_jsonb(new) ->> 'source') = 'ceremony') then
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

create table if not exists public.ceremony_proposals (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  subject_profile_id uuid references public.profiles(id) on delete cascade,
  subject_dependent_id uuid references public.dependents(id) on delete cascade,
  kind text not null check (kind in ('baptism', 'confirmation', 'league')),
  league_id uuid references public.leagues(id),
  ceremony_date date not null,
  status text not null default 'proposed' check (status in ('proposed', 'confirmed', 'declined')),
  proposed_by uuid references public.profiles(id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check ((subject_profile_id is not null) <> (subject_dependent_id is not null)),
  check ((kind = 'league') = (league_id is not null))
);

alter table public.ceremony_proposals enable row level security;

drop policy if exists "ceremony_proposals: select" on public.ceremony_proposals;
create policy "ceremony_proposals: select" on public.ceremony_proposals
  for select using (
    subject_profile_id = auth.uid()
    or subject_dependent_id in (select id from public.dependents where guardian_id = auth.uid())
    or public.is_admin_of(congregation_id)
    or (league_id is not null and public.is_league_admin_of(league_id))
  );

grant select on public.ceremony_proposals to authenticated;
grant all on public.ceremony_proposals to service_role;
-- No insert/update/delete grants — mutated only via the three RPCs below.

create or replace function public.propose_ceremony_date(
  target_id uuid, p_is_dependent boolean, p_kind text, p_ceremony_date date, p_league_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  target_congregation_id uuid;
  target_pending_league_id uuid;
  target_pending_baptism boolean;
  target_pending_confirmation boolean;
  new_id uuid;
begin
  if p_kind not in ('baptism', 'confirmation', 'league') then
    raise exception 'Invalid kind.';
  end if;

  if p_is_dependent then
    select p.congregation_id, d.pending_league_id, d.pending_baptism, d.pending_confirmation
      into target_congregation_id, target_pending_league_id, target_pending_baptism, target_pending_confirmation
      from public.dependents d join public.profiles p on p.id = d.guardian_id
      where d.id = target_id;
  else
    select congregation_id, pending_league_id, pending_baptism, pending_confirmation
      into target_congregation_id, target_pending_league_id, target_pending_baptism, target_pending_confirmation
      from public.profiles where id = target_id;
  end if;

  if target_congregation_id is null then
    raise exception 'Not found.';
  end if;

  if p_kind = 'league' then
    if target_pending_league_id is null then raise exception 'No pending league request.'; end if;
    if p_league_id is distinct from target_pending_league_id then raise exception 'League does not match the pending request.'; end if;
    if not (public.is_admin_of(target_congregation_id) or public.is_league_admin_of(p_league_id)) then
      raise exception 'not authorized';
    end if;
  elsif p_kind = 'baptism' then
    if not target_pending_baptism then raise exception 'No pending baptism request.'; end if;
    if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  else
    if not target_pending_confirmation then raise exception 'No pending confirmation request.'; end if;
    if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  end if;

  if exists (
    select 1 from public.ceremony_proposals
    where status = 'proposed' and kind = p_kind and (subject_profile_id = target_id or subject_dependent_id = target_id)
  ) then
    raise exception 'A date has already been proposed and is awaiting a response.';
  end if;

  insert into public.ceremony_proposals (congregation_id, subject_profile_id, subject_dependent_id, kind, league_id, ceremony_date, proposed_by)
  values (
    target_congregation_id,
    case when p_is_dependent then null else target_id end,
    case when p_is_dependent then target_id else null end,
    p_kind, p_league_id, p_ceremony_date, auth.uid()
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.propose_ceremony_date(uuid, boolean, text, date, uuid) to authenticated;

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

  -- Finalizes the underlying request the same way approve_baptism/
  -- approve_confirmation/approve_league do — duplicated here rather than
  -- calling those directly, since they check is_admin_of() against the
  -- caller, and the caller here is the member confirming, not an admin.
  if prop.kind = 'baptism' then
    if prop.subject_profile_id is not null then
      update public.profiles set baptised = true, pending_baptism = false, baptism_application = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_profile_id;
    else
      update public.dependents set baptised = true, pending_baptism = false, baptism_application = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_dependent_id;
    end if;
    event_title := 'Baptism';
  elsif prop.kind = 'confirmation' then
    if prop.subject_profile_id is not null then
      update public.profiles set confirmed = true, pending_confirmation = false, confirmation_application = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_profile_id;
    else
      update public.dependents set confirmed = true, pending_confirmation = false, confirmation_application = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_dependent_id;
    end if;
    event_title := 'Confirmation';
  else
    select label into league_label from public.leagues where id = prop.league_id;
    if prop.subject_profile_id is not null then
      update public.profiles set league_id = prop.league_id, pending_league_id = null, league_application = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_profile_id;
    else
      update public.dependents set league_id = prop.league_id, pending_league_id = null, league_application = null, reviewed_by = prop.proposed_by, reviewed_at = now() where id = prop.subject_dependent_id;
    end if;
    insert into public.league_points (congregation_id, league_id, points, reason, source, created_by)
      values (prop.congregation_id, prop.league_id, 5, 'New member installed', 'join_approved', prop.proposed_by);
    event_title := league_label || ' Installation';
  end if;

  -- One shared calendar entry per date+title+league, not one per person.
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

grant execute on function public.confirm_ceremony_date(uuid) to authenticated;

create or replace function public.decline_ceremony_date(proposal_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  prop record;
  is_owner boolean;
begin
  select * into prop from public.ceremony_proposals where id = proposal_id;
  if prop is null then raise exception 'Not found.'; end if;
  if prop.status <> 'proposed' then raise exception 'This has already been responded to.'; end if;

  is_owner := (prop.subject_profile_id is not null and prop.subject_profile_id = auth.uid())
    or (prop.subject_dependent_id is not null and exists(select 1 from public.dependents where id = prop.subject_dependent_id and guardian_id = auth.uid()));
  if not is_owner then raise exception 'not authorized'; end if;

  -- The underlying pending_* flag is left untouched, so the request stays
  -- visible to admins as pending — they can propose a different date.
  update public.ceremony_proposals set status = 'declined', responded_at = now() where id = proposal_id;
end;
$$;

grant execute on function public.decline_ceremony_date(uuid) to authenticated;
