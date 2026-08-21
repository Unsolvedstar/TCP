-- Login/app-open activity (last_active_at, 0002) tells you nothing about
-- whether someone still considers themselves a member — only they can
-- answer that. This adds a periodic self-confirmation instead of inferring
-- it from behavior: "still part of the parish?" with a real yes/no answer,
-- surfaced by the client roughly once a year per person (client-side logic,
-- see lib/membership-check-in.ts).

alter table public.profiles add column if not exists membership_confirmed_at timestamptz;
alter table public.profiles add column if not exists self_reported_left_at timestamptz;

-- Self-service, mirrors touch_my_last_active()'s shape. Confirming "still
-- here" also clears any earlier "I've left" self-report, since that's now
-- superseded.
create or replace function public.confirm_still_member()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set membership_confirmed_at = now(), self_reported_left_at = null where id = auth.uid();
end;
$$;

grant execute on function public.confirm_still_member() to authenticated;

-- Records that someone said they've left. Deliberately does NOT remove them,
-- change their role, or otherwise act automatically — same reasoning as the
-- activity tracker: this is a signal for an admin to follow up on, not an
-- automated departure pipeline.
create or replace function public.self_report_left()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set self_reported_left_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.self_report_left() to authenticated;
