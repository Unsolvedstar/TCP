-- POPIA compliance: stop collecting drawn signatures on baptism/confirmation/
-- league applications, and strip them from data already stored. `signed_at` is
-- kept as `submitted_at` since it's still a useful record of when the
-- application was submitted, but no longer implies a signature was taken.

-- 1. handle_new_user() trigger — no parameter list, so a plain replace is fine.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  p_congregation_id uuid := nullif(new.raw_user_meta_data->>'congregation_id', '')::uuid;
  p_ward_id uuid := nullif(new.raw_user_meta_data->>'ward_id', '')::uuid;
  claims_league_id uuid := nullif(new.raw_user_meta_data->>'league_id', '')::uuid;
  claims_baptised boolean := coalesce((new.raw_user_meta_data->>'already_baptised')::boolean, false);
  claims_confirmed boolean := coalesce((new.raw_user_meta_data->>'already_confirmed')::boolean, false) and claims_baptised;
begin
  if p_congregation_id is null or not exists (select 1 from public.congregations where id = p_congregation_id) then
    raise exception 'Invalid or missing congregation.';
  end if;
  if not public.ward_belongs_to(p_ward_id, p_congregation_id) then
    raise exception 'Invalid or missing ward for this congregation.';
  end if;
  if not public.league_belongs_to(claims_league_id, p_congregation_id) then
    raise exception 'Invalid league for this congregation.';
  end if;

  insert into public.profiles (
    id, full_name, phone, date_of_birth, gender, congregation_id, ward_id,
    league_id, baptised, confirmed,
    league_application, baptism_application, confirmation_application
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    new.raw_user_meta_data->>'phone',
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    nullif(new.raw_user_meta_data->>'gender', '')::gender,
    p_congregation_id,
    p_ward_id,
    claims_league_id,
    claims_baptised,
    claims_confirmed,
    case when claims_league_id is null then null else
      jsonb_build_object(
        'reason', new.raw_user_meta_data->>'league_reason', 'submitted_at', now(),
        'baptism_certificate', new.raw_user_meta_data->>'baptism_certificate', 'confirmation_certificate', new.raw_user_meta_data->>'confirmation_certificate'
      )
    end,
    case when not claims_baptised then null else
      jsonb_build_object(
        'type', new.raw_user_meta_data->>'baptism_type', 'sponsor_name', new.raw_user_meta_data->>'sponsor_name',
        'location', new.raw_user_meta_data->>'baptism_location', 'officiant_name', new.raw_user_meta_data->>'baptism_officiant',
        'submitted_at', now()
      )
    end,
    case when not claims_confirmed then null else
      jsonb_build_object(
        'mentor_name', new.raw_user_meta_data->>'mentor_name',
        'location', new.raw_user_meta_data->>'confirmation_location', 'officiant_name', new.raw_user_meta_data->>'confirmation_officiant',
        'submitted_at', now()
      )
    end
  );
  return new;
end;
$$;

-- 2. add_dependent() — drops the p_signature param, so the old 18-param
-- overload must be dropped explicitly first (create or replace only replaces
-- an exact signature match).
drop function if exists public.add_dependent(text, date, uuid, gender, uuid, boolean, boolean, text, text, text, text, text, text, text, text, text, text, text);

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
    guardian_id, full_name, date_of_birth, ward_id, gender,
    league_id, baptised, confirmed,
    league_application, baptism_application, confirmation_application
  )
  values (
    auth.uid(), p_full_name, p_date_of_birth, p_ward_id, p_gender,
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

-- 3. Member self-service request RPCs — same drop-then-recreate treatment.
drop function if exists public.request_league(uuid, text, text, text, text);

create or replace function public.request_league(
  new_league_id uuid, p_reason text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.league_belongs_to(new_league_id, (select congregation_id from public.profiles where id = auth.uid())) then
    raise exception 'Invalid league.';
  end if;
  update public.profiles set
    pending_league_id = new_league_id,
    league_application = jsonb_build_object(
      'reason', p_reason, 'submitted_at', now(),
      'baptism_certificate', p_baptism_certificate, 'confirmation_certificate', p_confirmation_certificate
    )
  where id = auth.uid();
end;
$$;

grant execute on function public.request_league(uuid, text, text, text) to authenticated;

drop function if exists public.request_baptism(text, text, text, text);

create or replace function public.request_baptism(p_type text default null, p_sponsor_name text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set
    pending_baptism = true,
    baptism_application = jsonb_build_object('type', p_type, 'sponsor_name', p_sponsor_name, 'note', p_note, 'submitted_at', now())
  where id = auth.uid();
end;
$$;

grant execute on function public.request_baptism(text, text, text) to authenticated;

drop function if exists public.request_confirmation(text, text, text, text);

create or replace function public.request_confirmation(
  p_mentor_name text default null, p_note text default null, p_baptism_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare already_baptised boolean;
begin
  select baptised into already_baptised from public.profiles where id = auth.uid();
  if not coalesce(already_baptised, false) then
    raise exception 'Baptism is required before requesting Confirmation.';
  end if;
  update public.profiles set
    pending_confirmation = true,
    confirmation_application = jsonb_build_object(
      'mentor_name', p_mentor_name, 'note', p_note, 'submitted_at', now(), 'baptism_certificate', p_baptism_certificate
    )
  where id = auth.uid();
end;
$$;

grant execute on function public.request_confirmation(text, text, text) to authenticated;

-- 4. Dependent request RPCs — same treatment.
drop function if exists public.request_dependent_league(uuid, uuid, text, text, text, text);

create or replace function public.request_dependent_league(
  target_id uuid, new_league_id uuid, p_reason text default null,
  p_baptism_certificate text default null, p_confirmation_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if not public.league_belongs_to(new_league_id, (select congregation_id from public.profiles where id = auth.uid())) then
    raise exception 'Invalid league.';
  end if;
  update public.dependents set
    pending_league_id = new_league_id,
    league_application = jsonb_build_object(
      'reason', p_reason, 'submitted_at', now(),
      'baptism_certificate', p_baptism_certificate, 'confirmation_certificate', p_confirmation_certificate
    )
  where id = target_id;
end;
$$;

grant execute on function public.request_dependent_league(uuid, uuid, text, text, text) to authenticated;

drop function if exists public.request_dependent_baptism(uuid, text, text, text, text);

create or replace function public.request_dependent_baptism(target_id uuid, p_type text default null, p_sponsor_name text default null, p_note text default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  update public.dependents set
    pending_baptism = true,
    baptism_application = jsonb_build_object('type', p_type, 'sponsor_name', p_sponsor_name, 'note', p_note, 'submitted_at', now())
  where id = target_id;
end;
$$;

grant execute on function public.request_dependent_baptism(uuid, text, text, text) to authenticated;

drop function if exists public.request_dependent_confirmation(uuid, text, text, text, text);

create or replace function public.request_dependent_confirmation(
  target_id uuid, p_mentor_name text default null, p_note text default null, p_baptism_certificate text default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare already_baptised boolean;
begin
  if not exists (select 1 from public.dependents where id = target_id and guardian_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  select baptised into already_baptised from public.dependents where id = target_id;
  if not coalesce(already_baptised, false) then
    raise exception 'Baptism is required before requesting Confirmation.';
  end if;
  update public.dependents set
    pending_confirmation = true,
    confirmation_application = jsonb_build_object(
      'mentor_name', p_mentor_name, 'note', p_note, 'submitted_at', now(), 'baptism_certificate', p_baptism_certificate
    )
  where id = target_id;
end;
$$;

grant execute on function public.request_dependent_confirmation(uuid, text, text, text) to authenticated;

-- 5. Erase signatures already stored in existing rows, renaming signed_at to
-- submitted_at in the same pass.
update public.profiles set baptism_application =
  (baptism_application - 'signature' - 'signed_at') || jsonb_build_object('submitted_at', baptism_application->'signed_at')
where baptism_application is not null;

update public.profiles set confirmation_application =
  (confirmation_application - 'signature' - 'signed_at') || jsonb_build_object('submitted_at', confirmation_application->'signed_at')
where confirmation_application is not null;

update public.profiles set league_application =
  (league_application - 'signature' - 'signed_at') || jsonb_build_object('submitted_at', league_application->'signed_at')
where league_application is not null;

update public.dependents set baptism_application =
  (baptism_application - 'signature' - 'signed_at') || jsonb_build_object('submitted_at', baptism_application->'signed_at')
where baptism_application is not null;

update public.dependents set confirmation_application =
  (confirmation_application - 'signature' - 'signed_at') || jsonb_build_object('submitted_at', confirmation_application->'signed_at')
where confirmation_application is not null;

update public.dependents set league_application =
  (league_application - 'signature' - 'signed_at') || jsonb_build_object('submitted_at', league_application->'signed_at')
where league_application is not null;
