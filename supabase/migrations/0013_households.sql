-- Families / households: group members and dependents under one shared
-- family record for the admin Registry screen. A household is purely a
-- grouping label — `dependents.guardian_id` still decides who manages a
-- child's record day to day, `household_id` just says which family file they
-- show up under. Admin-only for now: no RLS relaxation for ordinary members
-- to read a shared household (see 0013's plan notes) — that's a follow-up.

-- name starts null: an admin-minted code (0014) is an unclaimed slot with no
-- family attached yet — it's named automatically the moment someone first
-- claims it (registers or joins with that code).
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  name text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.households enable row level security;

drop policy if exists "households: select" on public.households;
create policy "households: select" on public.households
  for select using (public.is_admin_of(congregation_id));

grant select on public.households to authenticated;
grant all on public.households to service_role;
-- No insert/update/delete grants for authenticated — mutated only via the
-- admin_*_household() functions below, same convention as every other table.

alter table public.profiles add column if not exists household_id uuid references public.households(id) on delete set null;
alter table public.dependents add column if not exists household_id uuid references public.households(id) on delete set null;

-- Helper: does this household actually belong to this congregation? Same
-- pattern as ward_belongs_to/league_belongs_to — a null household_id (= "no
-- family assigned") is always valid.
create or replace function public.household_belongs_to(p_household_id uuid, p_congregation_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select p_household_id is null or exists(select 1 from public.households where id = p_household_id and congregation_id = p_congregation_id);
$$;

create or replace function public.admin_rename_household(target_id uuid, p_name text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.households where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.households set name = p_name where id = target_id;
end;
$$;

create or replace function public.admin_delete_household(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.households where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  delete from public.households where id = target_id;
end;
$$;

create or replace function public.admin_set_profile_household(target_id uuid, p_household_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.profiles where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if not public.household_belongs_to(p_household_id, target_congregation_id) then raise exception 'Invalid family.'; end if;
  update public.profiles set household_id = p_household_id where id = target_id;
end;
$$;

create or replace function public.admin_set_dependent_household(target_id uuid, p_household_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select p.congregation_id into target_congregation_id from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if not public.household_belongs_to(p_household_id, target_congregation_id) then raise exception 'Invalid family.'; end if;
  update public.dependents set household_id = p_household_id where id = target_id;
end;
$$;

grant execute on function public.admin_rename_household(uuid, text) to authenticated;
grant execute on function public.admin_delete_household(uuid) to authenticated;
grant execute on function public.admin_set_profile_household(uuid, uuid) to authenticated;
grant execute on function public.admin_set_dependent_household(uuid, uuid) to authenticated;

-- Re-declared in full from its latest form in 0012_remove_signatures.sql
-- (same "re-declare, don't edit the old file" convention 0004_league_admins.sql
-- uses) with one addition: a new dependent inherits the guardian's household
-- automatically, if the guardian already has one, so a family already on
-- file doesn't have to be re-assigned by hand every time a child is added.
-- Signature is unchanged from 0012, so this replaces that definition in
-- place rather than creating a second overload.
create or replace function public.add_dependent(
  p_full_name text, p_date_of_birth date, p_ward_id uuid, p_gender gender default null,
  p_initial_league_id uuid default null, p_already_baptised boolean default false, p_already_confirmed boolean default false,
  p_baptism_type text default null, p_sponsor_name text default null, p_mentor_name text default null,
  p_league_reason text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null,
  p_baptism_location text default null, p_baptism_officiant text default null,
  p_confirmation_location text default null, p_confirmation_officiant text default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  my_congregation_id uuid := (select congregation_id from public.profiles where id = auth.uid());
  my_household_id uuid := (select household_id from public.profiles where id = auth.uid());
  claims_baptised boolean := coalesce(p_already_baptised, false);
  claims_confirmed boolean := coalesce(p_already_confirmed, false) and claims_baptised;
begin
  if not public.ward_belongs_to(p_ward_id, my_congregation_id) then
    raise exception 'Invalid ward.';
  end if;
  if not public.league_belongs_to(p_initial_league_id, my_congregation_id) then
    raise exception 'Invalid league.';
  end if;

  insert into public.dependents (
    guardian_id, full_name, date_of_birth, ward_id, gender, household_id,
    league_id, baptised, confirmed,
    league_application, baptism_application, confirmation_application
  )
  values (
    auth.uid(), p_full_name, p_date_of_birth, p_ward_id, p_gender, my_household_id,
    p_initial_league_id, claims_baptised, claims_confirmed,
    case when p_initial_league_id is null then null else
      jsonb_build_object(
        'reason', p_league_reason, 'submitted_at', now(),
        'baptism_certificate', p_baptism_certificate, 'confirmation_certificate', p_confirmation_certificate
      )
    end,
    case when not claims_baptised then null else
      jsonb_build_object(
        'type', p_baptism_type, 'sponsor_name', p_sponsor_name,
        'location', p_baptism_location, 'officiant_name', p_baptism_officiant,
        'submitted_at', now()
      )
    end,
    case when not claims_confirmed then null else
      jsonb_build_object(
        'mentor_name', p_mentor_name,
        'location', p_confirmation_location, 'officiant_name', p_confirmation_officiant,
        'submitted_at', now()
      )
    end
  )
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.add_dependent(text, date, uuid, gender, uuid, boolean, boolean, text, text, text, text, text, text, text, text, text, text) to authenticated;
