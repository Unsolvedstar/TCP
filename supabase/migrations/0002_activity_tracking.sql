-- Activity tracking: lets admins see how long it's been since a member was
-- last active, instead of relying on someone manually marking a member as
-- having left. Dependents have no login, so this only ever applies to
-- profiles.

alter table public.profiles add column if not exists last_active_at timestamptz;

create or replace function public.touch_my_last_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set last_active_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.touch_my_last_active() to authenticated;
