-- Directory: also return each listed member's phone number so fellow members
-- can contact them. Still opt-in by profession (a member only appears if they've
-- set one) and still scoped to the caller's own congregation. Return type
-- changes, so the function has to be dropped and recreated.

drop function if exists public.congregation_directory();

create function public.congregation_directory()
returns table(id uuid, full_name text, profession text, ward_id uuid, phone text)
language sql security definer set search_path = public stable
as $$
  select p.id, p.full_name, p.profession, p.ward_id, p.phone
  from public.profiles p
  where p.congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    and p.profession is not null
  order by p.full_name;
$$;

grant execute on function public.congregation_directory() to authenticated;
