# Multi-congregation rewrite — what's left to do

This tracks the approved plan for turning this from a single-parish
("ELCSA Tshwane City Parish" / TCP) app into one that can serve any ELCSA
congregation, plus building out a real test suite (none exists today).

Full design rationale lives in the plan this was generated from; this file is
the checklist version to work through and check off.

**Status of the live Supabase project** (`fqfhgntmhjsfrdjozalc.supabase.co`):
no real member data yet — confirmed 2026-08-21. This is what makes a clean
schema rewrite safe instead of requiring a careful backfill migration.

**Phase 1 status (2026-08-21): implemented, tested, and verified against a
local Supabase instance. Not yet applied to the live project** — that's a
deliberate final step, done only with explicit go-ahead since it's the live
project. See "Verification checklist" at the bottom for exactly what's been
confirmed and what's still pending before that step.

**Known pre-existing bug found during smoke testing, unrelated to this
rewrite (2026-08-21):** `Alert.alert()` is a no-op stub on the web platform
(`react-native-web`'s implementation is literally `static alert() {}`), and
`vercel.json`/the `build:web` script confirm web is a real deployed target.
Every error message and every destructive-action confirmation (remove
member, remove dependent, promote/demote, the member-removal cascade
warning) silently does nothing on web today — the action is wrapped inside
the Alert callback, which never fires. Affects `dashboard.tsx`,
`members.tsx`, `app/(app)/_layout.tsx`, `certificate-picker.tsx`,
`dependent-card.tsx`, `edit-child-modal.tsx`, `edit-member-modal.tsx`,
`portal-details-card.tsx`, `portal-household-card.tsx`,
`portal-involvement-card.tsx`. Needs a cross-platform confirm/alert
replacement — tracked here as a separate follow-up, not fixed as part of
this rewrite.

## Scope split

- **Phase 1 (below): backend multi-tenancy.** The security-critical part.
  Every table/RLS policy/RPC function gets scoped to a congregation, TCP
  becomes tenant #1 (seeded data, not a special case), fully tested.
- **Phase 2 (not started, separate plan later): frontend generalization.**
  Congregation picker at signup, dynamic branding/logo/banking-details per
  congregation, landing-page congregation directory, admin UI to manage
  wards/leagues. Bigger, more open-ended, deliberately deferred until Phase 1
  is proven solid.

---

## Phase 1 — backend multi-tenancy

### Schema (`supabase/migrations/0001_init.sql`)

Rewritten in place (not a new `0002_*.sql`) — no real data to preserve, and
this keeps the existing "paste the whole file into the SQL editor" deploy
model the file's own header already documents.

- [x] Add `congregations` table: `id`, `name`, `slug` (unique), `address`,
      `domain`, `tagline`, `created_at`.
- [x] Add `wards` table: `id`, `congregation_id` (fk), `name`, `bank_code`,
      `color`, unique on `(congregation_id, name)`. Replaces the global `ward`
      enum and the hardcoded `wardCodes`/`wardColors` maps in `theme.ts`.
- [x] Add `leagues` table: `id`, `congregation_id` (fk), `key`, `label`,
      `info`, `color`, `has_badge`, unique on `(congregation_id, key)`.
      Replaces the global `league` enum and the hardcoded per-league contact
      info in `theme.ts`. (No "None" row — `league_id` is nullable and null
      already means "no league".)
- [x] `profiles`: replaced `ward ward` / `league league` with
      `congregation_id`, `ward_id`, `league_id` (nullable = "None"),
      `pending_league_id`.
- [x] `dependents`: same column swap. Deliberately has **no**
      `congregation_id` of its own — always derived via
      `guardian_id -> profiles.congregation_id`.
- [x] `announcements`: added `congregation_id` (not in the original plan —
      found during design review that the old policies had no tenant scoping
      at all).
- [x] Dropped the old `ward`/`league` enum types.
- [x] Seeded TCP as tenant #1: `congregations` row (slug
      `tshwane-city-parish`), its 5 `wards` (bank codes 100–500, colors
      matching the old `theme.ts`), its 9 `leagues` (label/color/info from
      the old `theme.ts`, `has_badge = true` for the 5 keys that have artwork).

### Security re-scoping (the actual point of this rewrite)

- [x] Added `is_admin_of(target_congregation_id)` — checks caller is an admin
      **and** belongs to that congregation.
- [x] Re-scoped all 17 admin RPCs (9 profile-side + 8 dependent-side — no
      dependent equivalent of `admin_set_role`) to `is_admin_of(...)` against
      the *target's* congregation.
- [x] Fixed `admin_set_role`'s last-admin guard to count admins **within the
      target's congregation**, not globally.
- [x] Re-scoped the `profiles`/`dependents` SELECT RLS policies to same-
      congregation only.
- [x] Re-scoped `stats_by_ward`, `stats_by_league`, `stats_by_gender`,
      `stats_sacraments`, `upcoming_birthdays` to the caller's own
      congregation (they now return `ward_id`/`league_id`, not denormalized
      names — the frontend joins against its own wards/leagues list).
- [x] Fixed `handle_new_user()` and `add_dependent()` to take/derive
      `congregation_id` correctly and validate `ward_id`/`league_id` belong to
      it before inserting — extended to `request_league`,
      `request_dependent_league`, `admin_update_member`,
      `admin_update_dependent` too (every RPC accepting a client-supplied
      `ward_id`/`league_id`), beyond the original plan's literal scope.
- [x] Extra hardening found during review: `service_role` needs explicit
      table grants (Postgres privilege checks are separate from RLS bypass —
      confirmed missing against the local CLI's Postgres image); narrow
      anon-callable `get_congregation_by_slug`/`get_wards_for_congregation`/
      `get_leagues_for_congregation` RPCs instead of a blanket `anon` SELECT
      grant on the lookup tables, so pre-auth registration can't enumerate
      every tenant; defense-in-depth re-check in `approve_league`/
      `approve_dependent_league` that the pending league still belongs to the
      target's congregation.

### Frontend — just enough to keep TCP working

Not the Phase 2 congregation-picker UI — only what's needed so the app still
compiles and works correctly for TCP now that `ward`/`league` are table rows
instead of enums.

- [x] `lib/types.ts` — `Ward`/`LeagueKey` string-union types removed;
      `Profile`/`Dependent` use `ward_id`/`league_id`/`pending_league_id`;
      new `WardRow`/`LeagueRow` types.
- [x] `theme.ts` — removed `wards`, `wardColors`, `wardCodes`, `leagues`,
      `leagueKeys`; new `lib/congregation-context.tsx`
      (`CongregationDataProvider`/`useCongregationData()`) fetches
      wards/leagues for the signed-in user's own congregation.
- [x] New `lib/congregation.ts` — pre-auth registration screen resolves TCP
      via a hardcoded slug constant through the anon RPCs (Phase 2 replaces
      this with a real picker).
- [x] Updated all call sites — turned out to be **18 files**, not the 8
      originally scoped: `register.tsx`, `edit-member-modal.tsx`,
      `edit-child-modal.tsx`, `portal-household-card.tsx`,
      `dependent-card.tsx`, `portal-involvement-card.tsx`, `members.tsx`,
      `dashboard.tsx`, `portal.tsx`, `ward-breakdown-card.tsx`,
      `league-breakdown-card.tsx`, `leagues-directory-card.tsx`,
      `banking.tsx`, `birthdays-card.tsx`, `league-badge.tsx` (now keyed by
      the league row's stable `key` string), plus `lib/types.ts`, `theme.ts`,
      `app/_layout.tsx`.
- [x] Deliberately left alone (correct for TCP today, Phase 2 scope):
      `banking.tsx`'s "South Ward (500)" example copy, `portal.tsx`'s
      "across 5 wards" copy.

---

## Testing (built from scratch)

### 1. Automated RLS/security tests — highest priority

- [x] Added Supabase CLI as a dev dependency, used Docker to run
      `supabase start` (a disposable local Postgres + Auth stack).
      **Never tested against the live project.**
- [x] Applied the rewritten migration to the local instance — clean on
      `supabase db reset`, twice in a row.
- [x] Wrote `supabase/tests/rls.test.mjs` (Node's built-in `node:test` +
      `@supabase/supabase-js`, run via
      `node --test supabase/tests/rls.test.mjs`). Seeds 2 congregations
      (admin + member + dependent each) and asserts, all 35 passing:
  - [x] Cross-tenant read isolation (profiles/dependents/announcements,
        including insert-forgery on announcements).
  - [x] Cross-tenant write isolation — all 17 re-scoped admin RPCs fail with
        "not authorized" across congregations (plus a positive-control check
        that same-congregation admin actions still work).
  - [x] Last-admin guard is per-congregation, not global.
  - [x] `stats_*`/`upcoming_birthdays` only return the caller's own
        congregation's data.
  - [x] A member can't submit a `ward_id`/`league_id` from another
        congregation (`request_league`, `add_dependent`).
  - [x] Regression checks: confirmation blocked without baptism, no raw
        self-promotion via table update, self-service RPCs only touch
        `auth.uid()`'s own row, `add_dependent` inherits the guardian's
        congregation automatically.

### 2. Unit tests for pure logic

- [x] Added Jest with the `jest-expo` preset (`npm test`).
- [x] `lib/church-calendar.ts` — Easter/Advent date math against known
      reference years (2024–2027), event ordering, upcoming-events windowing.
- [x] `lib/liturgical-theme.ts` — season/color for known boundary dates
      (Ash Wednesday, Holy Week, Easter, Pentecost, Advent, Twelfth Night).
- [x] `lib/dates.ts` — ISO formatting, including the UTC-offset shift bug
      `toLocalISODate` exists to avoid.
- 38/38 passing.

### 3. UI smoke test — manual, via a headless-browser walkthrough

Driven directly against `npx expo start --web` + the local Supabase instance
(no committed test artifact — Playwright was used ad hoc as the driving tool,
not added to the project). Confirmed with real screenshots and zero console
errors across every step:

- [x] Register as an adult, claiming baptism and a league at signup — ward
      and league pickers both populated from the DB (not hardcoded), correct
      colors/labels/badges/info text.
- [x] Register a household child ("Add Child") — same DB-driven pickers.
- [x] Portal renders correctly post-registration: hero ward name, ward/league
      stat chips, league info + badge, dependent card with ward/league chips.
- [x] Leagues directory tab shows all DB leagues with correct badges/colors.
- [x] Calendar tab renders.
- [x] Admin: Members screen — ward filter chips, league filter dropdown,
      per-member ward/league chips, admin list, all DB-driven.
- [x] Banking screen — ward codes table renders from the DB.
- [x] Login, and "Account Not Found" for a removed member (both via a
      real browser session).
- [x] Portal: request + cancel a baptism, with backend state confirmed at
      each step.
- [x] Portal: add a dependent, expand their card, open the birthday-edit
      form.
- [x] Admin: approve a pending league request, and separately deny one —
      both confirmed via UI click *and* independently via backend state
      (first attempt showed stale-DOM click-timing artifacts from insufficient
      settle time after tab navigation; a slower, isolated re-run confirmed
      both work correctly).
- [x] Admin: edit a member's full name — save pathway confirmed to execute
      end-to-end (RPC call fires, DB is written); the exact input-clearing
      behavior wasn't independently re-verified due to a `fill()` artifact in
      the test script, not a suspected app issue.
- [x] Admin: create and delete an announcement.
- [ ] **Blocked by the `Alert.alert` web bug above, not by anything in this
      rewrite**: admin promote/demote + last-admin block, admin remove a
      member with dependents (cascade warning), portal remove-a-dependent —
      the confirm button does nothing on web today. All three are covered
      structurally instead: `admin_set_role`/`admin_remove_member`/
      `remove_my_dependent` are exercised directly (bypassing the UI) by the
      RLS test suite, including the per-congregation last-admin guard.
- [ ] Not separately re-verified (same component/RPC patterns already proven
      elsewhere in this pass, low residual risk): logout click, forgot-
      password flow, portal request+cancel league/confirmation (baptism
      variant proven), request league/baptism/confirmation *for a dependent*
      specifically (own-account variant proven).

## Verification checklist before touching the live project

- [x] `supabase db reset` (local) applies the rewritten `0001_init.sql`
      cleanly, twice in a row.
- [x] RLS test script passes in full (35/35) against the local instance.
- [x] `npx tsc --noEmit` passes.
- [x] `npx expo start --web` serves with no console errors on every route
      exercised above.
- [ ] Manual smoke-test checklist — mostly done (see above); a few
      unchanged-code-path items not separately re-clicked.
- [ ] Only then: apply the rewritten SQL to the live (still-empty) Supabase
      project, same as the existing README's setup step. **Not done yet —
      needs explicit go-ahead, since it's the live project.**
