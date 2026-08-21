-- Registration no longer asks for baptism/confirmation certificate uploads
-- at sign-up time (that requirement stays exactly as-is for the *later*
-- portal league-join request flow, which is untouched by this migration).
-- Instead, registration now asks where and who (the officiating pastor)
-- performed the baptism/confirmation, recorded alongside the existing
-- attestation fields.

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
        'reason', new.raw_user_meta_data->>'league_reason', 'signature', new.raw_user_meta_data->>'signature', 'signed_at', now(),
        'baptism_certificate', new.raw_user_meta_data->>'baptism_certificate', 'confirmation_certificate', new.raw_user_meta_data->>'confirmation_certificate'
      )
    end,
    case when not claims_baptised then null else
      jsonb_build_object(
        'type', new.raw_user_meta_data->>'baptism_type', 'sponsor_name', new.raw_user_meta_data->>'sponsor_name',
        'location', new.raw_user_meta_data->>'baptism_location', 'officiant_name', new.raw_user_meta_data->>'baptism_officiant',
        'signature', new.raw_user_meta_data->>'signature', 'signed_at', now()
      )
    end,
    case when not claims_confirmed then null else
      jsonb_build_object(
        'mentor_name', new.raw_user_meta_data->>'mentor_name',
        'location', new.raw_user_meta_data->>'confirmation_location', 'officiant_name', new.raw_user_meta_data->>'confirmation_officiant',
        'signature', new.raw_user_meta_data->>'signature', 'signed_at', now()
      )
    end
  );
  return new;
end;
$$;

-- add_dependent gains the same 4 new params, appended so every existing
-- call site (which uses positional args) keeps working unchanged. The old
-- 14-param signature must be dropped explicitly first — `create or replace`
-- only replaces a function whose parameter list matches exactly; adding
-- params (even with defaults) creates a second overload instead, which then
-- makes every call ambiguous between the two.
drop function if exists public.add_dependent(text, date, uuid, gender, uuid, boolean, boolean, text, text, text, text, text, text, text);

create or replace function public.add_dependent(
  p_full_name text, p_date_of_birth date, p_ward_id uuid, p_gender gender default null,
  p_initial_league_id uuid default null, p_already_baptised boolean default false, p_already_confirmed boolean default false,
  p_baptism_type text default null, p_sponsor_name text default null, p_mentor_name text default null,
  p_league_reason text default null, p_signature text default null,
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
        'reason', p_league_reason, 'signature', p_signature, 'signed_at', now(),
        'baptism_certificate', p_baptism_certificate, 'confirmation_certificate', p_confirmation_certificate
      )
    end,
    case when not claims_baptised then null else
      jsonb_build_object(
        'type', p_baptism_type, 'sponsor_name', p_sponsor_name,
        'location', p_baptism_location, 'officiant_name', p_baptism_officiant,
        'signature', p_signature, 'signed_at', now()
      )
    end,
    case when not claims_confirmed then null else
      jsonb_build_object(
        'mentor_name', p_mentor_name,
        'location', p_confirmation_location, 'officiant_name', p_confirmation_officiant,
        'signature', p_signature, 'signed_at', now()
      )
    end
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- The parameter list grew, so the grant must be re-declared against the new
-- full signature or it would silently target a function that no longer exists.
grant execute on function public.add_dependent(text, date, uuid, gender, uuid, boolean, boolean, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
