-- Certificate detail fields for the digital baptism and league installation
-- certificates (components/certificateModal.tsx). Confirmation certificates
-- are intentionally left untouched — no paper template exists for them yet.

-- 1. League certificate signature/verse fields ------------------------------
-- These live on the league row itself, not a congregation-level settings
-- table, because no such settings screen exists yet and a league's
-- installation certificate needs a fixed "Parish Pastor" signature line that
-- is distinct per league in principle (even though today every league shares
-- the same parish pastor) and distinct from the baptism officiant, which is
-- already recorded per-record via the existing baptism_application.officiant_name.
alter table public.leagues add column if not exists chairperson_name text;
alter table public.leagues add column if not exists pastor_name text;
alter table public.leagues add column if not exists verse_reference text;
alter table public.leagues add column if not exists verse_text text;

create or replace function public.admin_set_league_certificate_details(
  target_league_id uuid, p_chairperson_name text, p_pastor_name text, p_verse_reference text, p_verse_text text
) returns void
language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.leagues where id = target_league_id;
  if not (
    public.is_league_admin_of(target_league_id)
    or public.is_admin_of(target_congregation_id)
  ) then
    raise exception 'not authorized';
  end if;
  update public.leagues set
    chairperson_name = p_chairperson_name,
    pastor_name = p_pastor_name,
    verse_reference = p_verse_reference,
    verse_text = p_verse_text
  where id = target_league_id;
end;
$$;

grant execute on function public.admin_set_league_certificate_details(uuid,text,text,text,text) to authenticated;

-- 2. Baptism certificate detail fields ---------------------------------------
-- These live inside the existing baptism_application jsonb rather than as
-- their own columns — that jsonb already carries the sacrament's freeform
-- detail (type/sponsor_name/officiant_name/location/note/submitted_at, see
-- 0001_init.sql and 0020_persist_sacrament_detail.sql for why it's never
-- nulled out once real) and a certificate is just another view onto the same
-- record. This RPC always overwrites all six of its own keys with whatever
-- was passed (empty string standing in for "not set") rather than trying to
-- partially merge — a full-overwrite save from a single edit form has no
-- partial-update ambiguity, unlike the sacrament claim fields it lives
-- alongside, which are written once at request/registration time and never
-- edited again.
create or replace function public.admin_set_baptism_certificate_details(
  target_id uuid, p_is_dependent boolean, p_register_no text, p_diocese text,
  p_parents text, p_birth_place text, p_verse_reference text, p_verse_text text
) returns void
language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  if p_is_dependent then
    select p.congregation_id into target_congregation_id
      from public.dependents d join public.profiles p on p.id = d.guardian_id where d.id = target_id;
  else
    select congregation_id into target_congregation_id from public.profiles where id = target_id;
  end if;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;

  if p_is_dependent then
    update public.dependents set baptism_application = coalesce(baptism_application, '{}'::jsonb) || jsonb_build_object(
      'register_no', p_register_no,
      'diocese', p_diocese,
      'parents', p_parents,
      'birth_place', p_birth_place,
      'verse_reference', p_verse_reference,
      'verse_text', p_verse_text
    ) where id = target_id;
  else
    update public.profiles set baptism_application = coalesce(baptism_application, '{}'::jsonb) || jsonb_build_object(
      'register_no', p_register_no,
      'diocese', p_diocese,
      'parents', p_parents,
      'birth_place', p_birth_place,
      'verse_reference', p_verse_reference,
      'verse_text', p_verse_text
    ) where id = target_id;
  end if;
end;
$$;

grant execute on function public.admin_set_baptism_certificate_details(uuid,boolean,text,text,text,text,text,text) to authenticated;
