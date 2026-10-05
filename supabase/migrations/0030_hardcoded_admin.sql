-- Hard-coded admin: the account tshikovhitshedza9@gmail.com is always an admin.
-- Applies to an existing profile now, and to any profile created for it later.

update public.profiles
set role = 'admin'
where id in (select id from auth.users where lower(email) = 'tshikovhitshedza9@gmail.com');

create or replace function public.enforce_hardcoded_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from auth.users
    where id = new.id and lower(email) = 'tshikovhitshedza9@gmail.com'
  ) then
    new.role := 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_hardcoded_admin on public.profiles;
create trigger profiles_enforce_hardcoded_admin
  before insert or update of role on public.profiles
  for each row execute function public.enforce_hardcoded_admin();
