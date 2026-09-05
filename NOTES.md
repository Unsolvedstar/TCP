# Notes / running to-do list

A working list of things we've identified but not finished — action items,
open decisions, and follow-ups from ongoing work. Check items off as they're
done; add new ones as they come up. (`MULTI_CONGREGATION_TODO.md` is a
separate, already-completed project's own checklist — don't merge into it.)

## Action items (things a person needs to actually do)

- [ ] Run `scripts/create-league-admin-accounts.mjs` to provision the
      generic per-league admin logins — needs a local `.env.service.local`
      with the Supabase *service role* key (see the script's header comment
      for exact steps). Save the printed email/password table somewhere real
      before closing the terminal; it's only shown once.
- [ ] Before running it: open `scripts/create-league-admin-accounts.mjs` and
      change `EMAIL_DOMAIN` from the placeholder
      (`league-admin.elcsatcp.internal`) to whatever you actually want.
- [ ] Distribute each league's generated credentials to whoever runs that
      league.

## Open feature work

- [x] **Ceremony certificates — step 1 (persistence fix), done.**
      `approve_baptism`/`approve_confirmation`/`approve_league` (+ dependent
      equivalents) and `confirm_ceremony_date()` no longer null out
      `baptism_application`/`confirmation_application`/`league_application`
      on approval — see `supabase/migrations/0020_persist_sacrament_detail.sql`.
      Sponsor/officiant/location/type detail now survives permanently, same
      as registration-time self-attested claims already did. No frontend
      change needed — `applicationDetailText()` already reads it.
- [x] **Ceremony certificates — step 2, done.** `components/certificate-modal.tsx`
      renders an in-app certificate (parish crest, name, ceremony date,
      sponsor/mentor/officiant detail, league badge for installations) from
      the persisted application detail, preferring the actual confirmed
      `ceremony_proposals` date over `reviewed_at`/`submitted_at` fallbacks.
      "View Certificate" links are wired into the member's own Portal
      (baptism/confirmation/league), the admin's Member Profile modal, and a
      guardian's own view of a dependent. Download/share uses
      `react-native-view-shot` (captures the certificate view to a PNG) +
      `expo-sharing` on native, and a plain `<a download>` on web — both new
      dependencies.
- [x] **Per-member consolidated profile view — done.** Tapping an adult in
      the Members registry now opens `MemberProfileModal`
      (`components/member-profile-modal.tsx`) — a read-focused view with
      contact info, family, sacraments, league (+ league-admin access),
      uploaded certificates, and activity, all in one place. "Edit" opens
      the existing `EditMemberModal` for actual changes. Dependents (the
      Children tab) still go straight to their edit modal — not extended to
      them yet, since the request was specifically about members.
- [x] **Service accounts excluded from stats — done.** `profiles` has a new
      `is_service_account` column (`supabase/migrations/0021_service_accounts.sql`);
      `stats_by_ward`/`stats_by_league`/`stats_by_gender`/`stats_sacraments`
      all now filter it out, same as they already do for `role = 'admin'`.
      `scripts/create-league-admin-accounts.mjs` sets the flag automatically
      for every account it creates going forward. Not yet run against the
      live database — see the local-Supabase testing note below.

## Other things from the spec's own "Planned / Not Yet Built" list (section 17)

- [x] **Family reference number — done.** Banking screen has a new "Family
      Reference Format" card: Family Code + Payment Code (no ward code,
      since a household isn't tied to one ward), with a live worked example
      using the signed-in member's own family code. `PortalFamilyCard` now
      also notes the code doubles as the banking reference, pointing to
      Banking.
- [x] ~~Removing a signature~~ — moot. Signature capture was removed
      entirely for POPIA compliance (`870319e`, 2026-08-25); there is
      nothing left to remove or redraw since no request collects a drawn
      signature anymore.
- [x] **Visual density pass — done, light-touch.** Dashboard's announcement
      composer (title/date/body/poster fields) is now collapsed behind a
      "+ New" button instead of always shown. Members registry's "Admins"
      and "League Admins" cards are now `CollapsibleSection`s (collapsed by
      default) instead of always-expanded `Card`s, so the actual member list
      is reachable with less scrolling. Member Portal's announcement feed
      now shows the latest 3 with a "Show all N" toggle instead of every
      post's full body inline. Most of the Portal and all of the Dashboard's
      ward/gender/sacrament breakdown charts were *already* collapsed by
      default via the existing `CollapsibleSection` component (see its own
      doc comment) — this pass extended that same pattern to the few spots
      that still always-rendered, rather than redesigning anything.

## Ongoing operational note (not a code task)

- The Families tab's "Needs Review" card (`admin_list_auto_merge_flags`)
  fills up as new members auto-match onto existing families by surname/ward
  or by picking a sibling — admins should check it periodically and
  Confirm/Split Off each entry, since nothing else surfaces it.

## Testing caveat for this session's changes

- `supabase/migrations/0021_service_accounts.sql` (service-account stats
  exclusion) was reviewed carefully by hand against the migrations it
  re-declares, but **not actually applied** to a database — Docker wasn't
  running in this environment, and `supabase/tests/rls.test.mjs` requires a
  local Supabase instance (`npx supabase start && npx supabase db reset`).
  Since it touches `handle_new_user()` (the signup trigger), run
  `node --test supabase/tests/rls.test.mjs` locally before this reaches
  production — a broken signup trigger blocks every new registration.
