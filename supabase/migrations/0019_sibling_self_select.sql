-- Let a member point at their own sibling by name, instead of relying only
-- on surname+ward guessing or a shared code ---------------------------------
-- 0017's silent surname+ward match only auto-merges when there's exactly
-- one candidate family — two same-surname families in the same ward means
-- neither gets merged, and the second person quietly starts their own new
-- family with nothing to catch the miss until an admin happens to notice.
--
-- This was first built into the registration wizard itself, but that's the
-- wrong place for it: the portal's Family card already has a well-established
-- "fix your family assignment after the fact" flow (the one-time nudge +
-- Join Family by code), and registration should only ask what's actually
-- needed to create the account (name, ward, login) — see the "which
-- questions come after account setup" discussion. So this lives entirely
-- post-signup: search by name is a second option alongside the existing
-- code entry, both reachable from the same portal card. Still nobody has to
-- be asked or wait on anyone; the member is answering about their own
-- relationships, whenever they get around to opening the app.

alter table public.household_auto_merges add column if not exists match_type text not null default 'surname_ward';
do $$ begin
  alter table public.household_auto_merges add constraint household_auto_merges_match_type_check check (match_type in ('surname_ward', 'self_selected'));
exception when duplicate_object then null;
end $$;

-- Name search, scoped to the caller's own congregation. Deliberately
-- returns only name + ward — never phone, email, household id, or anything
-- else — same "narrow RPC, minimum needed" posture as congregation_directory.
-- profile_id itself isn't sensitive (just a reference), so returning it is
-- fine — the client needs it to say "this one" back to join_sibling_family.
-- Authenticated only (not anon): this is a portal action now, not something
-- a pre-signup visitor needs to call.
create or replace function public.search_possible_relatives(p_query text)
returns table(profile_id uuid, full_name text, ward_name text)
language sql security definer set search_path = public stable
as $$
  select p.id, p.full_name, w.name
  from public.profiles p
  join public.wards w on w.id = p.ward_id
  where p.congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    and p.id <> auth.uid()
    and length(trim(coalesce(p_query, ''))) >= 2
    and p.full_name ilike '%' || trim(p_query) || '%'
  order by p.full_name
  limit 8;
$$;

grant execute on function public.search_possible_relatives(text) to authenticated;

-- Self-service: join the family of a specific person the caller picked by
-- name, from the portal. Same effect as join_family_by_code (cascades onto
-- the caller's own dependents too), but keyed by a chosen profile instead of
-- a shared secret code — a weaker signal than a code, so it's logged into
-- household_auto_merges the same as a silent surname+ward match, for the
-- admin Families tab to review.
create or replace function public.join_sibling_family(p_sibling_profile_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  my_congregation_id uuid;
  my_full_name text;
  target_household_id uuid;
  target_congregation_id uuid;
begin
  select congregation_id, full_name into my_congregation_id, my_full_name
  from public.profiles where id = auth.uid();

  select household_id, congregation_id into target_household_id, target_congregation_id
  from public.profiles where id = p_sibling_profile_id;

  if target_household_id is null or target_congregation_id is distinct from my_congregation_id then
    raise exception 'Could not find that person in your congregation.';
  end if;

  update public.profiles set household_id = target_household_id where id = auth.uid();
  update public.dependents set household_id = target_household_id where guardian_id = auth.uid();

  insert into public.household_auto_merges (household_id, profile_id, matched_surname, match_type)
  values (target_household_id, auth.uid(), public.derive_surname(my_full_name), 'self_selected');

  return target_household_id;
end;
$$;

grant execute on function public.join_sibling_family(uuid) to authenticated;

-- Re-declared from 0017 to also surface match_type to the admin review UI,
-- so the Needs Review card can say which kind of match each row was.
-- Dropped first: the OUT-parameter row shape changed (added match_type), and
-- Postgres refuses `create or replace` across a return-type change.
drop function if exists public.admin_list_auto_merge_flags();

create or replace function public.admin_list_auto_merge_flags()
returns table(
  id uuid,
  household_id uuid,
  household_name text,
  profile_id uuid,
  profile_name text,
  matched_surname text,
  match_type text,
  created_at timestamptz
)
language sql security definer set search_path = public stable
as $$
  select m.id, m.household_id, h.name, m.profile_id, p.full_name, m.matched_surname, m.match_type, m.created_at
  from public.household_auto_merges m
  join public.households h on h.id = m.household_id
  join public.profiles p on p.id = m.profile_id
  where m.reviewed_at is null
    and public.is_admin_of(h.congregation_id)
  order by m.created_at desc;
$$;

grant execute on function public.admin_list_auto_merge_flags() to authenticated;
