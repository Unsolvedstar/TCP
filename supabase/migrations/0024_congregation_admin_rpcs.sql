-- Phase 2: RPCs to let a congregation manage its own wards/leagues/branding/
-- banking in-app, instead of only ever existing because a migration seeded
-- them once. Every write RPC follows the same shape as admin_update_member
-- (0001_init.sql): resolve the target congregation, then gate with
-- is_admin_of(target_congregation_id) — a congregation admin can only ever
-- manage their own congregation, there is no cross-congregation admin
-- concept. "Create" RPCs have no existing target row to resolve a
-- congregation from, so they derive it from the caller's own profile
-- instead, same as admin_generate_household_codes (0014_family_codes.sql).

-- 1. Pre-auth congregation directory ----------------------------------------
-- Unlike get_congregation_by_slug (which requires already knowing a slug),
-- this deliberately lists every congregation — needed for the signup picker
-- and the landing-page directory. Only ever returns the same safe columns
-- get_congregation_by_slug does (plus the two new branding fields) — never
-- banking details, which stay authenticated-only via the existing
-- congregation_bank_accounts/congregation_payment_codes RLS policies.
create or replace function public.list_congregations()
returns table(id uuid, name text, slug text, tagline text, address text, logo_url text, primary_color text)
language sql security definer set search_path = public stable
as $$
  select id, name, slug, tagline, address, logo_url, primary_color from public.congregations order by name;
$$;

grant execute on function public.list_congregations() to anon, authenticated;

-- Widen the existing by-slug lookup with the same two branding fields, so a
-- deep link (?slug=...) into registration can render branding immediately
-- without a second round trip. Postgres rejects `create or replace` when the
-- OUT-parameter return shape changes (same issue fixed for a different
-- function in 0019_sibling_self_select.sql) — drop it first.
drop function if exists public.get_congregation_by_slug(text);
create or replace function public.get_congregation_by_slug(p_slug text)
returns table(id uuid, name text, address text, tagline text, logo_url text, primary_color text)
language sql security definer set search_path = public stable
as $$
  select id, name, address, tagline, logo_url, primary_color from public.congregations where slug = p_slug;
$$;

-- 2. Validation helper, mirroring ward_belongs_to/league_belongs_to ---------
create or replace function public.bank_account_belongs_to(p_account_id uuid, p_congregation_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists(select 1 from public.congregation_bank_accounts where id = p_account_id and congregation_id = p_congregation_id);
$$;

-- 3. Ward CRUD ---------------------------------------------------------------
create or replace function public.admin_create_ward(p_name text, p_bank_code int, p_color text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid; new_id uuid;
begin
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if not public.is_admin_of(my_congregation_id) then raise exception 'not authorized'; end if;
  insert into public.wards (congregation_id, name, bank_code, color)
  values (my_congregation_id, p_name, p_bank_code, p_color)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_update_ward(target_id uuid, p_name text, p_bank_code int, p_color text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.wards where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.wards set name = p_name, bank_code = p_bank_code, color = p_color where id = target_id;
end;
$$;

create or replace function public.admin_delete_ward(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.wards where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if exists(select 1 from public.profiles where ward_id = target_id)
    or exists(select 1 from public.dependents where ward_id = target_id) then
    raise exception 'This ward still has members assigned to it. Reassign them to another ward first.';
  end if;
  delete from public.wards where id = target_id;
end;
$$;

grant execute on function public.admin_create_ward(text, int, text) to authenticated;
grant execute on function public.admin_update_ward(uuid, text, int, text) to authenticated;
grant execute on function public.admin_delete_ward(uuid) to authenticated;

-- 4. League CRUD --------------------------------------------------------------
-- `key` is set only at creation and never changed by admin_update_league —
-- it's used elsewhere as a stable identifier (e.g. components/leagueBadge.tsx
-- keys badge artwork off it), so renaming it in place could silently detach a
-- league from its badge.
create or replace function public.admin_create_league(p_key text, p_label text, p_info text, p_color text, p_has_badge boolean)
returns uuid language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid; new_id uuid;
begin
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if not public.is_admin_of(my_congregation_id) then raise exception 'not authorized'; end if;
  insert into public.leagues (congregation_id, key, label, info, color, has_badge)
  values (my_congregation_id, p_key, p_label, p_info, p_color, p_has_badge)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_update_league(target_id uuid, p_label text, p_info text, p_color text, p_has_badge boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.leagues where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.leagues set label = p_label, info = p_info, color = p_color, has_badge = p_has_badge where id = target_id;
end;
$$;

create or replace function public.admin_delete_league(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.leagues where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if exists(select 1 from public.profiles where league_id = target_id or pending_league_id = target_id)
    or exists(select 1 from public.dependents where league_id = target_id or pending_league_id = target_id)
    or exists(select 1 from public.league_admins where league_id = target_id) then
    raise exception 'This league still has members, pending requests, or league admins attached to it. Reassign or remove them first.';
  end if;
  delete from public.leagues where id = target_id;
end;
$$;

grant execute on function public.admin_create_league(text, text, text, text, boolean) to authenticated;
grant execute on function public.admin_update_league(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.admin_delete_league(uuid) to authenticated;

-- 5. Congregation branding ----------------------------------------------------
-- `slug` is intentionally not editable here — it's baked into deep links and
-- printed/shared QR codes, so changing it is a deliberate manual DB action,
-- not an in-app form field.
create or replace function public.admin_update_congregation_branding(
  p_name text, p_tagline text, p_address text, p_logo_url text, p_primary_color text, p_accent_color text
) returns void language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid;
begin
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if not public.is_admin_of(my_congregation_id) then raise exception 'not authorized'; end if;
  update public.congregations set
    name = p_name, tagline = p_tagline, address = p_address,
    logo_url = p_logo_url, primary_color = p_primary_color, accent_color = p_accent_color
  where id = my_congregation_id;
end;
$$;

create or replace function public.admin_set_snapscan_qr(p_snapscan_qr_url text)
returns void language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid;
begin
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if not public.is_admin_of(my_congregation_id) then raise exception 'not authorized'; end if;
  update public.congregations set snapscan_qr_url = p_snapscan_qr_url where id = my_congregation_id;
end;
$$;

grant execute on function public.admin_update_congregation_branding(text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_set_snapscan_qr(text) to authenticated;

-- 6. Bank accounts + payment codes --------------------------------------------
create or replace function public.admin_create_bank_account(p_name text, p_bank_name text, p_account_number text, p_branch_code text, p_sort_order int default 0)
returns uuid language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid; new_id uuid;
begin
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if not public.is_admin_of(my_congregation_id) then raise exception 'not authorized'; end if;
  insert into public.congregation_bank_accounts (congregation_id, name, bank_name, account_number, branch_code, sort_order)
  values (my_congregation_id, p_name, p_bank_name, p_account_number, p_branch_code, p_sort_order)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_update_bank_account(target_id uuid, p_name text, p_bank_name text, p_account_number text, p_branch_code text, p_sort_order int default 0)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.congregation_bank_accounts where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  update public.congregation_bank_accounts set
    name = p_name, bank_name = p_bank_name, account_number = p_account_number, branch_code = p_branch_code, sort_order = p_sort_order
  where id = target_id;
end;
$$;

create or replace function public.admin_delete_bank_account(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.congregation_bank_accounts where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if exists(select 1 from public.congregation_payment_codes where account_id = target_id) then
    raise exception 'This account still has payment reference codes pointing at it. Remove or reassign them first.';
  end if;
  delete from public.congregation_bank_accounts where id = target_id;
end;
$$;

grant execute on function public.admin_create_bank_account(text, text, text, text, int) to authenticated;
grant execute on function public.admin_update_bank_account(uuid, text, text, text, text, int) to authenticated;
grant execute on function public.admin_delete_bank_account(uuid) to authenticated;

create or replace function public.admin_create_payment_code(p_code text, p_label text, p_account_id uuid, p_sort_order int default 0)
returns uuid language plpgsql security definer set search_path = public
as $$
declare my_congregation_id uuid; new_id uuid;
begin
  select congregation_id into my_congregation_id from public.profiles where id = auth.uid();
  if not public.is_admin_of(my_congregation_id) then raise exception 'not authorized'; end if;
  if not public.bank_account_belongs_to(p_account_id, my_congregation_id) then raise exception 'Invalid account.'; end if;
  insert into public.congregation_payment_codes (congregation_id, account_id, code, label, sort_order)
  values (my_congregation_id, p_account_id, p_code, p_label, p_sort_order)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_update_payment_code(target_id uuid, p_code text, p_label text, p_account_id uuid, p_sort_order int default 0)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.congregation_payment_codes where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  if not public.bank_account_belongs_to(p_account_id, target_congregation_id) then raise exception 'Invalid account.'; end if;
  update public.congregation_payment_codes set code = p_code, label = p_label, account_id = p_account_id, sort_order = p_sort_order where id = target_id;
end;
$$;

create or replace function public.admin_delete_payment_code(target_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare target_congregation_id uuid;
begin
  select congregation_id into target_congregation_id from public.congregation_payment_codes where id = target_id;
  if not public.is_admin_of(target_congregation_id) then raise exception 'not authorized'; end if;
  delete from public.congregation_payment_codes where id = target_id;
end;
$$;

grant execute on function public.admin_create_payment_code(text, text, uuid, int) to authenticated;
grant execute on function public.admin_update_payment_code(uuid, text, text, uuid, int) to authenticated;
grant execute on function public.admin_delete_payment_code(uuid) to authenticated;
