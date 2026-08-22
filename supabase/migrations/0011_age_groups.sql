-- Age-group categorization (child/adult/elder) is computed live from
-- date_of_birth, never stored — someone reclassifies automatically as they
-- age, with no manual re-tagging. This was already partly true for
-- stats_sacraments()/upcoming_birthdays() (see their original comments:
-- "adult vs child is based on actual age... not on whether someone's a
-- profiles row or a dependents row"), but that reasoning only ever produced
-- a binary child/adult split, and the client (members.tsx's "Adults"/
-- "Children" tabs) never applied it at all — it just labeled the profiles
-- table "Adults" and the dependents table "Children", which is wrong: a
-- self-registered profiles row isn't necessarily an adult, and a
-- guardian-managed dependent isn't always a minor. This migration adds a
-- third bracket (elder) and a single shared function so every call site —
-- server and client — uses the same thresholds.
--
-- 60 is South Africa's Older Persons Act (13 of 2006) definition of an
-- "older person" — a defensible, non-arbitrary default for this parish.
-- Adjust here if the congregation wants a different cutoff; every RPC below
-- reads it from this one function.

create or replace function public.age_group(dob date, as_of date default current_date)
returns text
language sql immutable
as $$
  select case
    when dob is null then null
    when extract(year from age(as_of, dob)) < 18 then 'child'
    when extract(year from age(as_of, dob)) >= 60 then 'elder'
    else 'adult'
  end;
$$;

grant execute on function public.age_group(date, date) to authenticated;

drop function if exists public.stats_sacraments();

create or replace function public.stats_sacraments()
returns table(total bigint, baptised bigint, confirmed bigint, adults bigint, children bigint, elders bigint)
language sql security definer set search_path = public stable
as $$
  with people as (
    select baptised, confirmed, date_of_birth, false as fallback_is_child, congregation_id
    from public.profiles where role = 'member'
    union all
    select d.baptised, d.confirmed, d.date_of_birth, true as fallback_is_child, p.congregation_id
    from public.dependents d join public.profiles p on p.id = d.guardian_id
  ),
  classified as (
    select
      baptised, confirmed,
      -- Elder can only ever be inferred from a known birthdate — when it's
      -- missing (optional at registration), fall back to the old table-based
      -- guess, same as before, which only ever yields child or adult.
      coalesce(public.age_group(date_of_birth), case when fallback_is_child then 'child' else 'adult' end) as bracket
    from people
    where congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  )
  select
    count(*),
    count(*) filter (where baptised),
    count(*) filter (where confirmed),
    count(*) filter (where bracket = 'adult'),
    count(*) filter (where bracket = 'child'),
    count(*) filter (where bracket = 'elder')
  from classified;
$$;

grant execute on function public.stats_sacraments() to authenticated;

drop function if exists public.upcoming_birthdays(int);

create or replace function public.upcoming_birthdays(days_ahead int default 30)
returns table(full_name text, date_of_birth date, age_group text, ward_id uuid, next_birthday date)
language sql security definer set search_path = public stable
as $$
  with people as (
    select full_name, date_of_birth, ward_id
    from public.profiles where role = 'member' and date_of_birth is not null
      and congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    union all
    select d.full_name, d.date_of_birth, d.ward_id
    from public.dependents d join public.profiles p on p.id = d.guardian_id
    where d.date_of_birth is not null and p.congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  ),
  next_bday as (
    select
      full_name, date_of_birth, ward_id,
      public.age_group(date_of_birth) as age_group,
      make_date(
        extract(year from current_date)::int
          + case when make_date(extract(year from current_date)::int, extract(month from date_of_birth)::int,
                    least(extract(day from date_of_birth)::int, 28)) < current_date then 1 else 0 end,
        extract(month from date_of_birth)::int,
        least(extract(day from date_of_birth)::int, 28)
      ) as next_birthday
    from people
  )
  select full_name, date_of_birth, age_group, ward_id, next_birthday
  from next_bday
  where next_birthday <= current_date + (days_ahead || ' days')::interval
  order by next_birthday;
$$;

grant execute on function public.upcoming_birthdays(int) to authenticated;

drop function if exists public.birthdays_for_month(date);

create or replace function public.birthdays_for_month(p_month_start date)
returns table(full_name text, date_of_birth date, age_group text, ward_id uuid, day_of_month int)
language sql security definer set search_path = public stable
as $$
  with people as (
    select full_name, date_of_birth, ward_id from public.profiles
    where role = 'member' and date_of_birth is not null
      and congregation_id = (select congregation_id from public.profiles where id = auth.uid())
    union all
    select d.full_name, d.date_of_birth, d.ward_id from public.dependents d join public.profiles p on p.id = d.guardian_id
    where d.date_of_birth is not null and p.congregation_id = (select congregation_id from public.profiles where id = auth.uid())
  )
  select full_name, date_of_birth, public.age_group(date_of_birth), ward_id,
    least(extract(day from date_of_birth)::int, 28)
  from people
  where extract(month from date_of_birth) = extract(month from p_month_start);
$$;

grant execute on function public.birthdays_for_month(date) to authenticated;
