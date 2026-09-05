-- Professions: an optional, self-reported field members can set on their own
-- profile ("Teacher", "Plumber", "Nurse", ...) and a congregation-wide
-- directory anyone signed in can browse — useful for finding a skill inside
-- the congregation. Unlike the Registry (admin-only), this is visible to
-- every member, so it goes through a narrow RPC that returns only name +
-- profession + ward (never phone, DOB, sacrament status, etc.) rather than
-- relaxing the `profiles: select` RLS policy itself — same "narrow RPC
-- instead of relaxing RLS" approach as my_family() and the pre-auth
-- congregation lookups in 0001_init.sql.

alter table public.profiles add column if not exists profession text;

-- 1. Self-service: set my own profession ------------------------------------
-- Same one-line pattern as update_my_phone/update_my_birthday/update_my_gender
-- in 0001_init.sql. Blank clears it back out of the directory.

create or replace function public.update_my_profession(new_profession text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set profession = nullif(trim(new_profession), '') where id = auth.uid();
end;
$$;

grant execute on function public.update_my_profession(text) to authenticated;

-- 2. Congregation-wide directory ---------------------------------------------
-- Only members who've actually set a profession show up — someone who
-- hasn't opted in isn't listed at all, not listed with a blank field.

create or replace function public.congregation_directory()
returns table(id uuid, full_name text, profession text, ward_id uuid)
language sql security definer set search_path = public stable
as $$
  select p.id, p.full_name, p.profession, p.ward_id
  from public.profiles p
  where p.congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    and p.profession is not null
  order by p.full_name;
$$;

grant execute on function public.congregation_directory() to authenticated;
