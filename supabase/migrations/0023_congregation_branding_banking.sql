-- Phase 2 of the multi-congregation rewrite (see MULTI_CONGREGATION_TODO.md):
-- gives each congregation its own branding (logo/colors) and banking details
-- (accounts + payment reference codes), instead of the hardcoded TCP-specific
-- values in app/(app)/banking.tsx, app/(app)/bankingSnapscan.tsx and
-- components/landingPage.tsx. `congregations: select own` (0001_init.sql)
-- already covers these new columns — no new RLS policy needed there.

alter table public.congregations add column if not exists logo_url text;
alter table public.congregations add column if not exists primary_color text not null default '#1c4906';
alter table public.congregations add column if not exists accent_color text;
alter table public.congregations add column if not exists snapscan_qr_url text;

-- One congregation can have several named bank accounts (TCP has "General"
-- and "Building") — a child table, not fixed columns, since there's no
-- guarantee every congregation has exactly two, or names them the same way.
create table if not exists public.congregation_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  name text not null,
  bank_name text not null,
  account_number text not null,
  branch_code text not null,
  sort_order int not null default 0,
  unique (congregation_id, name)
);

-- Payment reference codes (e.g. "PLG" for Pledge & Tithe) each point at one of
-- their own congregation's bank accounts — replaces the hardcoded
-- REFERENCE_CODES array in app/(app)/banking.tsx.
create table if not exists public.congregation_payment_codes (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  account_id uuid not null references public.congregation_bank_accounts(id) on delete cascade,
  code text not null,
  label text not null,
  sort_order int not null default 0,
  unique (congregation_id, code)
);

alter table public.congregation_bank_accounts enable row level security;
alter table public.congregation_payment_codes enable row level security;

-- Same "own congregation only" shape as `wards: select own congregation` /
-- `leagues: select own congregation` (0001_init.sql) — no anon grant, since
-- banking details must not be pre-auth-visible. All writes go through the
-- admin RPCs in 0024_congregation_admin_rpcs.sql, never a raw table grant.
drop policy if exists "congregation_bank_accounts: select own congregation" on public.congregation_bank_accounts;
create policy "congregation_bank_accounts: select own congregation" on public.congregation_bank_accounts
  for select using (congregation_id = (select congregation_id from public.profiles where id = auth.uid()));

drop policy if exists "congregation_payment_codes: select own congregation" on public.congregation_payment_codes;
create policy "congregation_payment_codes: select own congregation" on public.congregation_payment_codes
  for select using (congregation_id = (select congregation_id from public.profiles where id = auth.uid()));

grant select on public.congregation_bank_accounts to authenticated;
grant select on public.congregation_payment_codes to authenticated;
grant all on public.congregation_bank_accounts to service_role;
grant all on public.congregation_payment_codes to service_role;

-- Backfill TCP's own current hardcoded values (app/(app)/banking.tsx today)
-- so production doesn't regress once the frontend switches to reading these
-- tables instead of its own constants.
insert into public.congregation_bank_accounts (congregation_id, name, bank_name, account_number, branch_code, sort_order)
select c.id, a.name, a.bank_name, a.account_number, a.branch_code, a.sort_order
from public.congregations c
cross join (values
  ('General', 'Standard Bank', '012 165 778', '012 345', 0),
  ('Building', 'Standard Bank', '014 148 757', '012 345', 1)
) as a(name, bank_name, account_number, branch_code, sort_order)
where c.slug = 'tshwane-city-parish'
on conflict (congregation_id, name) do nothing;

insert into public.congregation_payment_codes (congregation_id, account_id, code, label, sort_order)
select c.id, ba.id, p.code, p.label, p.sort_order
from public.congregations c
cross join (values
  ('PLG', 'Pledge & Tithe', 'General', 0),
  ('SOF', 'Sunday Offering', 'General', 1),
  ('BPT', 'Baptism', 'General', 2),
  ('DCN', 'Diaconate Ministry', 'General', 3),
  ('CNF', 'Confirmation', 'General', 4),
  ('RLY', 'Rally', 'General', 5),
  ('HVT', 'Harvest', 'General', 6),
  ('BLD', 'Building Project', 'Building', 7)
) as p(code, label, account_name, sort_order)
join public.congregation_bank_accounts ba on ba.congregation_id = c.id and ba.name = p.account_name
where c.slug = 'tshwane-city-parish'
on conflict (congregation_id, code) do nothing;
