# Architecture

How the app is put together, for someone about to change it. For setup see the
[README](../README.md); for running it in production see [DEPLOYMENT.md](DEPLOYMENT.md).

## The big picture

```
 phone / desktop browser (PWA)
   Expo + React Native Web  ──HTTPS──▶  Supabase
   screens in app/                       ├─ Auth        (email + password)
   no server of our own                  ├─ Postgres    (tables + Row Level Security + SQL functions)
                                         └─ Edge Function: snapscan-webhook
```

There is **no application server**. The website is static files; every read and
write goes straight from the browser to Supabase. That is safe because the
*database* decides who may do what, not the app.

## Who can do what (roles)

| Role | How someone becomes one | Can |
|---|---|---|
| **Member** | Registers | Their own profile and household; read their congregation's shared info |
| **Congregation admin** | `profiles.role = 'admin'` | Everything in their congregation: registry, approvals, announcements, settings |
| **League admin** | A row in `league_admins` | Announcements, events, join requests and certificate details for *their league only* |
| **Service account** | `profiles.is_service_account` | The generic per-league logins from `scripts/createLeagueAdminAccounts.mjs`; excluded from headcounts |

One address is a hard-coded admin: migration `0030_hardcoded_admin.sql` forces
`role = 'admin'` for `tshikovhitshedza9@gmail.com` and reverts any demotion.

## The security model

1. **Row Level Security (RLS)** is on for every table. Policies scope every query to
   the caller's own `congregation_id`, so one congregation can never read another's rows.
2. **Sensitive writes are SQL functions, not table updates.** A member cannot
   `update profiles set role = 'admin'` or mark themselves baptised; those changes
   only happen through `security definer` functions (`approve_baptism`,
   `admin_update_member`, `confirm_ceremony_date`, …) that check, inside the
   database, that the caller is allowed.
3. **The client never holds the service-role key.** Anything needing it (deleting an
   auth account, creating the league logins) is a separate script or the Edge Function.
4. The Edge Function `snapscan-webhook` checks SnapScan's HMAC-SHA256 signature
   itself and returns `503` until `SNAPSCAN_WEBHOOK_AUTH_KEY` is set.

The tests in `supabase/tests/rls.test.mjs` assert these rules against a real
local database (two congregations, an admin/member/child in each, and nothing
crossing between them). **Run them after changing any migration.**

## Data model

The complete diagram, with every column and relationship, is in [ERD.md](ERD.md).

Tables (all in `public`; the league points/leaderboard feature was removed in migration 0026):

| Table | Holds |
|---|---|
| `congregations` | One row per parish: name, branding, SnapScan merchant code |
| `wards`, `leagues` | Each congregation's own wards and leagues (league `key` ties to bundled badge artwork) |
| `profiles` | A member: contact details, ward, league, sacrament flags, role, household, last-active, and the saved `baptism_application` / `confirmation_application` / `league_application` details (JSON) |
| `dependents` | Children registered under a guardian; same sacrament and league fields |
| `households` | A family and its shareable code |
| `household_auto_merges` | Matches made automatically at signup that an admin should review |
| `league_admins` | Who administers which league |
| `announcements`, `events` | Posts for the whole church or one league |
| `ceremony_proposals` | An admin's proposed ceremony date, awaiting the member's confirmation |
| `congregation_bank_accounts`, `congregation_payment_codes` | Banking details and reference codes |
| `snapscan_payments` | Giving initiated in the app; status updated only by the webhook |

**Migrations** (`supabase/migrations/`) are the source of truth. Convention: never
edit an old migration — add a new one that re-declares the function or table
change. Production already has all 31; apply new ones with `npx supabase db push`.

Notable behaviours that live in the database:
- **Request → schedule → confirm.** Approving a baptism, confirmation or league request is a
  three-step flow (`0010`): an admin proposes a date, the member confirms it, and only then does the
  request complete and a calendar entry get created. Denying is immediate.
- **Application details are kept** after approval (`0020`) so certificates can show sponsor,
  officiant, place and so on.
- **Family codes** (`0014`, `0016`, `0017`): admins mint codes in batches; registering with the same
  ward and surname as an existing family joins it automatically (flagged for review).
- **Age groups** (`0011`): child under 18, elder 60+, matching `lib/ageGroups.ts`.

## The app

### Routing and screens
Expo Router: the file path is the URL. `app/(app)/` is the signed-in area and its
`_layout.tsx` holds the sign-in and profile gates. `app/(app)/(tabs)/_layout.tsx`
is the navigation — a bottom tab bar on phones and a left sidebar from 900px wide.

### State
Three React contexts wrap the app (`app/_layout.tsx`):
`AuthProvider` (session + profile), `CongregationDataProvider` (the member's
congregation, wards, leagues, bank accounts) and `LeagueAdminProvider` (which
leagues the user administers). Screens read them with `useAuth()`,
`useCongregationData()` and `useLeagueAdmin()`.

### Talking to the database
Plain `supabase.from(...)` for reads; `supabase.rpc('function_name', {...})` for
every protected write. `lib/rpcAction.ts` wraps the "call, alert on failure,
refresh on success" pattern used across the admin screens.

### UI building blocks (`components/ui.tsx`)
- `Button` (full-size), `ActionButton` (small row actions: primary / danger / neutral),
  `TabButton`, `ChipButton`, `OptionButton`. **Anything tappable must be one of
  these or a `Pressable` with `accessibilityRole="button"`** — never `<Text onPress>`.
  They share one guard that ignores double-taps and turns a failing handler into an alert.
- `Field`, `SelectField`, `DateField` — text inputs are 16px so iPhones don't zoom on focus.
- `Card`, `Chip`, `ScreenTitle`, `SectionLabel`.
- `lib/alert.native.tsx` / `lib/alert.web.tsx`: React Native's `Alert` does nothing on the
  web, so the web build has its own dialog host (`<AlertHost />` in the root layout). Import
  `Alert` from `lib/alert`, never from `react-native`.

### Look and feel
`theme.ts` holds the palette; its green is the parish crest's. `lib/liturgicalTheme.ts`
tints banners with the colour of the church year (purple for Lent, red for Pentecost…).
Floating dots and background blur are limited to desktop browsers and native apps, because they
make scrolling shake on phones.

### Wide screens
`lib/layout.ts` defines the 900px breakpoint, `useIsWide()` and the centred content widths
(`contentWide` / `contentMedium` / `contentSheet` / `contentNarrow`). `components/columns.tsx`
puts two groups side by side on wide screens and stacks them on phones.

### Certificates
- `components/certificatePaper.tsx` lays out a certificate from plain props (no data fetching),
  one layout each for baptism, confirmation and league installation.
- `components/certificateArt.tsx` draws everything as SVG: crest, parish seal, frame, the
  baptism arch, league emblem, confirmation emblem. No scanned images.
- `lib/certificateVerse.ts` guarantees a Bible verse: the admin's own if set, else a default
  (World English Bible, public domain).
- `components/certificateModal.tsx` loads the confirmed ceremony date and saves the sheet
  as a PNG: `html2canvas-pro` at 3× on the web, `react-native-view-shot` on a phone app.

### Installable web app (PWA)
`public/` is copied to the site root: `manifest.webmanifest`, `sw.js`, `icons/`, and
`index.html` (head tags plus the stability CSS). The service worker caches only the app shell
and Expo's hashed files; every other request, including all of Supabase, goes to the network.
Bump `VERSION` in `sw.js` to clear every device's cache.
`components/installAppButton.tsx` shows the install button.

## Things that are deliberately absent

- **No email.** No confirmation or reset emails; `detectSessionInUrl` is off.
- **No drawn signatures** — a signature image is personal data the parish has no need to keep (POPIA).
- **No analytics or tracking.**
- **No server-side admin from the app.** Deleting a member removes their `profiles` row only;
  their auth account remains, and signing in then shows "Account Not Found".

## Conventions

- TypeScript, `strict`. Match the surrounding file's style (no semicolons, single quotes).
- One styles file per screen/component (`styles/` or `*.styles.ts`).
- Platform splits use `.native.tsx` / `.web.tsx` files.
- Run `npx tsc --noEmit` and `npm test` before pushing.
