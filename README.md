# ELCSA Tshwane City Parish — Parish App

A web app that church members install on their phone (a PWA). Members sign in,
see their ward, league and sacraments, register their children and family, and
download their baptism, confirmation and league certificates. The parish office
approves requests, posts announcements, keeps the registry and sees live
numbers. It also holds the parish's banking details and a SnapScan giving page.

It is built to serve **any ELCSA congregation**, not just Tshwane City: each
congregation has its own wards, leagues, branding and banking, and can never see
another's data.

**Live:** https://tcp-tau.vercel.app

## Documentation

| If you are… | Read |
|---|---|
| A member | [Member guide](docs/MEMBER_GUIDE.md) |
| In the parish office / an admin | [Admin guide](docs/ADMIN_GUIDE.md) |
| Hosting or looking after the app | [Deployment & operations](docs/DEPLOYMENT.md) |
| A developer changing the code | [Architecture](docs/ARCHITECTURE.md) (this page covers getting started) |
| Looking for what is still to do | [NOTES.md](NOTES.md) — the running checklist |

[MULTI_CONGREGATION_TODO.md](MULTI_CONGREGATION_TODO.md) is the finished plan
and test record for making the app multi-congregation; it is history, not a to-do list.

## What it does

**Members**
- Register with ward, league, sacrament details and family; sign in with email and password.
- A portal showing ward, league, baptism and confirmation status, with request forms for baptism, confirmation and a league change.
- Household: register children who have no phone, join relatives' families by code or name.
- Certificates (baptism, confirmation, league installation) viewable and downloadable as a PNG.
- Parish announcements (with a Listen button), upcoming birthdays, the church calendar, a member directory (opt-in), banking details and SnapScan giving.
- Installs to the home screen and opens offline (data still needs a connection).

**Parish office**
- Dashboard: people counts and breakdowns by ward, league, gender and sacrament.
- Registry: search and filter members and dependents, edit anyone, review pending requests, schedule ceremonies, manage families and family codes, promote or remove admins.
- Announcements and events, for the whole church or one league.
- Per-league admins, with their own tools and certificate details.
- Congregation settings: branding, wards, leagues, bank accounts, payment reference codes, SnapScan.

## Stack

- [Expo](https://expo.dev) SDK 58 + React Native + TypeScript, with [Expo Router](https://docs.expo.dev/router/introduction/). One codebase; **the web build is what ships**.
- [Supabase](https://supabase.com): Postgres, authentication, Row Level Security, and one Edge Function (the SnapScan webhook).
- Hosted on [Vercel](https://vercel.com) as a static site (`vercel.json`).
- Jest for unit tests; a Docker-based suite for the database's security rules.

The app **sends no email** — there is no email confirmation and no password-reset
email, so no email service is needed. A forgotten password is reset by the parish
office (see the [Admin guide](docs/ADMIN_GUIDE.md)).

## Run it locally

You need Node 22 and a Supabase project (free tier is fine) — see
[Deployment & operations](docs/DEPLOYMENT.md) to create and prepare one.

```bash
npm install
cp .env.example .env      # then fill in your project's URL and anon key
npm run web               # http://localhost:8081
```

`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are safe to ship
in the app: the anon key only grants what the database's Row Level Security allows.
They are baked into the build, so set them **before** building or deploying.

### Commands

| Command | What it does |
|---|---|
| `npm run web` | Dev server for the website, with hot reload |
| `npm test` | Unit tests (Jest) |
| `npx tsc --noEmit` | Type-check |
| `npm run build:web` | Production build into `dist/` |
| `npx supabase start` | Local database in Docker (needs Docker Desktop) |
| `npx supabase db reset` | Rebuild the local database from every migration |
| `node --test supabase/tests/rls.test.mjs` | Database security tests (run against the **local** database only) |
| `node supabase/tests/smoke.local.mjs` | Extra local checks (admin rule, RPCs) |

GitHub Actions (`.github/workflows/ci.yml`) type-checks, runs the Jest tests and
builds the website on every push and pull request.

## Project layout

```
app/                 Screens (Expo Router: one file = one URL)
  index.tsx            landing page, or redirect to the portal/dashboard when signed in
  login, register, congregations, privacy      public screens
  (app)/               signed-in area
    (tabs)/              portal, dashboard, members, announcements, directory, banking, leagueAdmin
    congregationAdmin, bankingSnapscan         pushed screens
components/          Reusable UI (ui.tsx has the buttons and fields; certificate*.tsx draw the certificates)
lib/                 Logic with no UI: Supabase client, auth/congregation context, dates, calendar, validation helpers
  __tests__/           Jest tests
styles/              Per-screen style sheets
public/              Files served as-is: PWA manifest, service worker, icons, index.html
supabase/
  migrations/          the database, in order (0001 … 0031) — the source of truth
  functions/           snapscan-webhook (Edge Function)
  tests/               database security tests
scripts/             One-off admin scripts (createLeagueAdminAccounts.mjs)
docs/                The documentation above
theme.ts             Colours; the green is the parish crest's
```

More detail on how the pieces fit together is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Licence

See [LICENSE](LICENSE).
