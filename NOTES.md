# Notes / running to-do list

A working list of things we've identified but not finished — action items,
open decisions, and follow-ups from ongoing work. Check items off as they're
done; add new ones as they come up. (`MULTI_CONGREGATION_TODO.md` is a
separate, already-completed project's own checklist — don't merge into it.)

## Launch checklist (status 2026-11-01)

**Decision: this ships as a website members install as a PWA** — no App Store /
Play Store. So no bundle ID, developer accounts or EAS builds are needed
(`eas.json` was removed; the native `ios`/`android` bits of app.json are unused).

Done in code: SDK 58 upgrade, vector certificates (always print a verse), PWA
(manifest, service worker, icons, in-app "Install the app" button), wide-screen
layout, real buttons everywhere, security headers. Production Supabase project
is active and has all 31 migrations.

Documentation: see the table in README.md — member guide, admin guide, deployment &
operations runbook, architecture. Keep them in step with the app (e.g. button names).

Found while documenting (2026-11-01):
- **Fixed:** the member portal re-fetched the profile in an endless loop (hundreds of requests a minute), which made the screen twitch;
  the admin Members screen showed **no dependents** (an ambiguous database relationship); the yearly "still part of the parish?" banner
  could never appear. See the commits for details.
- **Fixed (2026-11-02):** a brand-new member no longer sees the yearly check-in on their first visit (counted from registration).
- **Partly done:** the "Who should see this?" label is now "Post to", so it no longer promises privacy. The database still lets every
  member of the congregation read league announcements/events; restricting that needs an RLS policy change (new migration) if wanted.

Still needs a person:

- [x] **Website deployed: https://tcp-tau.vercel.app** (Vercel, from this repo).
      Checked 2026-11-01: pages, manifest, service worker and icons are served with
      the right types and security headers; the build points at the real Supabase
      project; the congregation record is intact. Still to do for this: attach a
      proper domain if wanted (then update the two Supabase URLs below).
- [x] Supabase minimum password length: **decided to leave it at 6** (the app
      enforces 8, the server allows 6) — no change wanted. **Email confirmation stays OFF on
      purpose — the app sends no emails.** Consequence: anyone can register with an
      email address they don't own, and there is no self-service password reset.
      Forgotten passwords are reset by the parish office; until an in-app admin
      reset exists, run this in the Supabase SQL editor:
      `update auth.users set encrypted_password = crypt('NewTempPass1', gen_salt('bf')) where email = 'member@example.com';`
      and tell the member to change it under My Details. Keep the hard-coded admin
      (migration 0030) in mind: if that account were ever deleted, anyone could
      register its email and become admin.
- [ ] **ON HOLD (until SnapScan is live): SnapScan webhook.** Redeployed without JWT
      verification on 2026-11-02 (returns 503 "not configured" until the auth key is
      set); remaining step is the secret below. Original note — deployed with
      `verify_jwt: true`, so SnapScan's callbacks (no Supabase token) are rejected
      before the function's own HMAC check. `supabase/config.toml` now says
      `verify_jwt = false`; production needs one redeploy:
      `npx supabase functions deploy snapscan-webhook --no-verify-jwt`
      (then `npx supabase secrets set SNAPSCAN_WEBHOOK_AUTH_KEY=...`). Only
      matters once SnapScan is live.
- [ ] **Try it on real phones** once deployed: Android Chrome (Install the app
      button / browser prompt) and iPhone Safari (Share → Add to Home Screen).
      Check sign-in, choosing a photo for a
      certificate, certificate download, offline open, and the installed icon.
      Note: an installed iPhone web app keeps its own storage, so members sign in
      again after installing.
- [ ] **Have the parish review the privacy policy** (`app/privacy.tsx`, served at
      `/privacy`, linked from the landing, sign-in and registration screens). It is
      written from what the app really collects and shows, but a POPIA policy
      should name the parish's Information Officer and a contact email/phone —
      add those, and have someone qualified approve the wording.
- [ ] Optional: Sentry (needs a DSN); redraw the league badges in
      `assets/brand/badge*.png` (still scans of the bulletins; the crest is vector
      now); 3 high `npm audit` advisories remain, all in Expo's build CLI (zod),
      not the shipped app.

## Action items (things a person needs to actually do)

- [x] **Done 2026-11-02 (9 accounts created; on Node 20 run with `--experimental-websocket`).** Run `scripts/createLeagueAdminAccounts.mjs` to provision the
      generic per-league admin logins — needs a local `.env.service.local`
      with the Supabase *service role* key (see the script's header comment
      for exact steps). Save the printed email/password table somewhere real
      before closing the terminal; it's only shown once.
- [x] Email format chosen: `league-<key>@elcsa-tcp.internal` (e.g.
      `league-youth@elcsa-tcp.internal`). Not a real inbox, nothing is ever sent to it.
- [ ] Distribute each league's generated credentials to whoever runs that
      league.
- [ ] **SnapScan paygate — needs a real SnapScan merchant account (none
      exists yet).** Register at snapscan.co.za, then from SnapScan support
      (help@snapscan.co.za) get your merchant code and enter it in
      Congregation Settings → "SnapScan Checkout (Paygate)" once signed in as
      a congregation admin; ask them to point your webhook at
      `https://<project-ref>.functions.supabase.co/snapscan-webhook` once
      deployed (`npx supabase functions deploy snapscan-webhook`). Until the
      merchant code is set, the checkout button on the SnapScan screen stays
      disabled — nothing breaks, it just isn't live yet. There is no QR-code
      fallback anymore (removed by request) — SnapScan giving is checkout-only.
- [x] **SnapScan webhook now fails closed.** It verifies SnapScan's HMAC-SHA256
      signature and returns 503 until `SNAPSCAN_WEBHOOK_AUTH_KEY` is set
      (`npx supabase secrets set SNAPSCAN_WEBHOOK_AUTH_KEY=...`, key from
      SnapScan support). Redeploy: `npx supabase functions deploy
      snapscan-webhook`. Local testing only: `SNAPSCAN_WEBHOOK_ALLOW_UNSIGNED=true`.
- [x] **Migrations 0013–0026 pushed to the live project, done (2026-09-23).**
      Discovered while chasing a "name search doesn't work" report: `npx
      supabase migration list --linked` showed only 0001–0012 had ever
      reached production — everything from 0013 (households) onward,
      including `search_possible_relatives` (0019) and `congregation_directory`
      (0015), only existed locally. That's exactly why search silently
      returned nothing: the RPCs the client called didn't exist server-side.
      Ran `npx supabase db push --linked --yes`, confirmed via
      `migration list` (local/remote now both at 0026) and a direct
      PostgREST call (`search_possible_relatives`/`congregation_directory`
      now 200, `league_points`/`league_leaderboard` now 404 as expected).
      Docker still wasn't available in this session, so the RLS suite
      couldn't be run against a fresh local reset first — this was pushed
      straight to production with the user's explicit go-ahead. Run
      `npx supabase start`, `npx supabase db reset`, `node --test
      supabase/tests/rls.test.mjs` next time Docker's available, as a
      retroactive check.

## Open feature work

- [x] **Ceremony certificates — step 1 (persistence fix), done.**
      `approve_baptism`/`approve_confirmation`/`approve_league` (+ dependent
      equivalents) and `confirm_ceremony_date()` no longer null out
      `baptism_application`/`confirmation_application`/`league_application`
      on approval — see `supabase/migrations/0020_persist_sacrament_detail.sql`.
      Sponsor/officiant/location/type detail now survives permanently, same
      as registration-time self-attested claims already did. No frontend
      change needed — `applicationDetailText()` already reads it.
- [x] **Ceremony certificates — step 2, done.** `components/certificateModal.tsx`
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
      (`components/memberProfileModal.tsx`) — a read-focused view with
      contact info, family, sacraments, league (+ league-admin access),
      uploaded certificates, and activity, all in one place. "Edit" opens
      the existing `EditMemberModal` for actual changes. Dependents (the
      Children tab) still go straight to their edit modal — not extended to
      them yet, since the request was specifically about members.
- [x] **Service accounts excluded from stats — done.** `profiles` has a new
      `is_service_account` column (`supabase/migrations/0021_service_accounts.sql`);
      `stats_by_ward`/`stats_by_league`/`stats_by_gender`/`stats_sacraments`
      all now filter it out, same as they already do for `role = 'admin'`.
      `scripts/createLeagueAdminAccounts.mjs` sets the flag automatically
      for every account it creates going forward. Not yet run against the
      live database — see the local-Supabase testing note below.
- [x] **Gamification (league points/leaderboard) removed, done (2026-09-23).**
      Leagues themselves (membership, league admins, league-scoped content)
      are untouched — only the point-scoring layer on top is gone: no more
      auto-awarded points for posting announcements/events or an approved
      join, no more manual admin "Award Points", no more leaderboard.
      `supabase/migrations/0026_remove_league_points.sql` drops the
      `league_points` table, `league_leaderboard()`,
      `admin_award_league_points()`, and the `award_points_for_league_content`
      triggers, and re-declares `approve_league`/`approve_dependent_league`/
      `confirm_ceremony_date` without the point-insert step (everything else
      they did — finalizing the request, persisting sacrament/league detail,
      creating the calendar entry — is unchanged). Removed
      `components/leagueLeaderboardCard.tsx` and its usages in
      `app/(app)/portal.tsx` and `app/(app)/dashboard.tsx`, and the
      corresponding tests in `supabase/tests/rls.test.mjs`.

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

## Testing status

- [x] **All migrations (0001–0021) and the full RLS suite now actually run
      and pass, done.** Docker/Supabase came up fine once started — the
      earlier "not actually applied" caveat is stale. `db reset` initially
      failed on `0019_sibling_self_select.sql`: it re-declared
      `admin_list_auto_merge_flags()` with an extra `match_type` output
      column via `create or replace`, which Postgres rejects for a
      return-shape change without a `drop function` first — fixed by adding
      the drop. Running the suite also turned up two bugs in the test file
      itself (not the migrations): a wrong destructuring of `expectOk()`'s
      return value, and a test still asserting family_code as mandatory
      after 0017 deliberately made it optional (auto-match/auto-start
      instead). One more test expected a raw table UPDATE to error, but
      Postgres just silently affects 0 rows when RLS has no UPDATE policy —
      confirmed by direct repro that the row is genuinely never mutated, so
      fixed the assertion to check the real invariant instead. All 86
      `rls.test.mjs` cases and the full jest suite (58 tests) pass against a
      fresh `npx supabase db reset`.
