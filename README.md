# ELCSA Tshwane City Parish — Mobile App

A mobile-first church member app: sign in, see which league/organisation you belong
to, request baptism/confirmation or a league change, register children who don't
have their own phone under your household, keep everyone's birthday on file, and
(for admins) approve those requests and see live ward/league/sacrament/birthday
stats and post announcements.

**Stack**
- [Expo](https://expo.dev) + React Native + TypeScript, using [Expo Router](https://docs.expo.dev/router/introduction/) for navigation — this is the standard, actively-maintained way to ship one codebase to iOS, Android, *and* a web build, testable instantly via the free Expo Go app (no Mac, no Android Studio, no Apple/Google developer account needed for development).
- **This is also a real website, not just a phone app.** The exact same code renders in a browser via [react-native-web](https://necolas.github.io/react-native-web/) — same screens, same login, same Supabase backend, no separate build to maintain.
- [Supabase](https://supabase.com) for the backend: Postgres database, real authentication (email + password), and Row Level Security so the rules about who-can-see/change-what live in the database itself, not just in app code. Free tier is enough for a parish this size.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com), create a free account and a new project (any region close to South Africa, e.g. `eu-west` or `af-south-1` if offered).
2. Once it's provisioned, open **SQL Editor** in the left sidebar, paste the entire contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it. This creates every table, security policy, and function the app needs.
3. Open **Authentication → Providers → Email** and, for now, turn **off** "Confirm email" so new sign-ups can log in immediately (turn it back on later once you've set up a custom email sender, if you want that extra step).
4. Open **Authentication → URL Configuration** and add these to **Redirect URLs** (needed for the "Forgot password?" flow — without this, password-reset emails will link somewhere Supabase refuses to redirect to):
   - `elcsatcp://**` (the native app)
   - `http://localhost:8081/**` (the web app in local dev)
   - your production web domain, once you have one, e.g. `https://yourparish.example.com/**`
5. Open **Project Settings → API**. Copy the **Project URL** and the **anon / public key**.

## 2. Configure the app

```bash
cp .env.example .env
```

Paste your Project URL and anon key into `.env`.

## 3. Install and run

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (iOS App Store / Google Play) on your phone. That's it — no build step, no simulator required. Shake your phone to reload if needed.

**To run it as a website instead**, in the same folder:

```bash
npx expo start --web
```

This opens the app in your regular browser at `http://localhost:8081`, with hot reload, using the exact same screens and Supabase backend as the phone app.

## 4. Make yourself the first admin

1. In the running app, register a normal account (this is what real members will do too).
2. In the Supabase dashboard, go to **Authentication → Users**, find your new account, and copy its **User UID**.
3. Back in **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin' where id = 'paste-your-uid-here';
   ```
4. Sign out and back in inside the app — you'll now land on the admin Dashboard instead of the member Portal.

This raw-SQL step is only needed once, to create your *first* admin (there's no
one with admin access yet to click a button for you). Every admin after that can
be promoted straight from the app — open their profile in **Members** and tap
"Promote to Admin". The Members screen also lists current admins with a "Remove
Access" button, so demoting someone back to a regular member doesn't need SQL
either. (You can't demote the very last admin — the app blocks it, since that
would lock everyone out of admin tools.)

## What changed from the earlier browser prototype

The original version (the `.html` files one folder up) stored everything in the
browser's `localStorage` — fine for a demo on one device, but it meant no real
login security, no syncing between phones, and no way for two admins to see the
same data. This version fixes all of that:

- **Real accounts.** Supabase Auth issues real sessions; passwords are hashed
  server-side, never stored in the app.
- **Server-enforced permissions.** A member cannot make themselves an admin, mark
  themselves as baptised, or edit someone else's profile — even by tampering with
  the app — because every sensitive write runs through a Postgres function that
  checks the request is coming from an admin *inside the database*, not just in
  the app's UI.
- **One shared database.** Every phone sees the same live data — a pending request
  approved by one admin instantly disappears for every other admin.

**One deliberate simplification:** because every member now needs a real login,
admins can no longer hand-register a "member" who's never opened the app
themselves (the old prototype allowed this, since it had no real accounts). Every
member — including office staff — signs up once through the Register screen; an
admin then reviews/edits their ward, league, and sacrament status, or promotes
them to admin via the SQL command above.

**Birthdays and children.** Every profile now has an optional birthday (asked at
sign-up, editable anytime under "My Details"), and every account can register a
"household" of dependents — kids who don't have their own phone. A parent manages
a child's league/baptism/confirmation requests from their own portal, and the
child appears in the admin Members screen under a separate "Children" tab, with
the guardian's name shown. Both adults and children count toward the "people in
the church" total and the ward/league/sacrament charts, and a congregation-wide
"Upcoming Birthdays" list (next 30 days) is visible to everyone, member portal and
admin dashboard alike — matching the common practice of announcing birthdays in
service.

**Gender.** An optional Gender field (Male/Female) lives alongside ward and
birthday — asked at sign-up, editable anytime by the member or an admin, and set
per-child in a household too. It shows as a chip in the registry and rolls up into
a "Gender Breakdown" chart next to the ward/league/sacrament ones, since two of
the leagues (Prayer Men's and Prayer Women's) are gender-specific.

**Church Calendar.** Easter, Lent, Pentecost, Advent, and the rest of the major
observances of the Christian year are computed on the fly (Easter's date moves
every year, so everything else — Ash Wednesday, Holy Week, Ascension, Pentecost —
is calculated from it) and shown as an upcoming-events list on both the portal and
dashboard. No database table for this — it's pure date math, nothing to maintain.

**Real branding, pulled from the parish's own bulletins.** The green in this app
isn't a colour someone picked — it's sampled directly from the actual ELCSA
Tshwane City Parish crest, scanned out of the weekly Sunday bulletin PDFs
(`assets/brand/church-logo.png`), along with the navy, gold, and red used
elsewhere in the parish's own materials (`theme.ts` → `colors.brandNavy` /
`brandGoldVivid` / `brandRed`). Three leagues that have their own official badge
artwork — Young Adults League, ELCSAMO, and the Prayer Men's League — show that
badge (`components/league-badge.tsx`) instead of just a colour chip; the rest
still get a colour chip, since that's an honest reflection of what artwork
actually exists for them.

**The theme shifts with the church year.** `lib/liturgical-theme.ts` derives the
traditional Western liturgical colour for today's date — purple for Lent and
Advent, red for Pentecost and Reformation Day, gold for the festal seasons
(Christmas, Eastertide, Maundy Thursday, All Saints), green the rest of the year
— the same reckoning that decides paraments on the altar. That colour tints hero
banners across the portal, dashboard, banking screen, and landing page, and shows
as a small season label (e.g. "LENT", "EASTERTIDE") so it reads as intentional,
not random. It's an accent layer only — the parish's green crest and identity
never change underneath it.

**A real landing page.** Signed-out visitors — mainly on the web build — now land
on `components/landing-page.tsx` instead of being bounced straight to the sign-in
form: the crest, today's liturgical season, what's next in the church calendar,
and Sign In / Create Account buttons. Signed-in users skip straight past it to
their portal or dashboard, same as before.

**The app icon and splash screen are the real crest too.** `assets/icon.png`,
`assets/android-icon-foreground.png` / `android-icon-monochrome.png`,
`assets/favicon.png`, and `assets/splash-icon.png` were all regenerated from the
same scanned crest — cream background, full seal ring (the "Growing Together in
Christ" tagline was dropped from the small versions since it turns to an
illegible smear at actual home-screen icon sizes; the seal shape alone still
reads clearly even at 32px). The splash screen uses the `expo-splash-screen`
plugin (newly added to `app.json`), which was sitting half-configured before —
the asset existed but nothing referenced it.
>
> **Not verified on a real build.** I generated and composited these correctly
> and confirmed `npx expo config` resolves them without error, but an app
> icon/splash only truly proves itself in a native build (`eas build` or
> `expo prebuild`) or the Expo Go icon cache, neither of which I can run here.
> Check it once you've built — home-screen icon, Android adaptive icon on a
> circular/squircle launcher, and the splash flash on cold start — before
> shipping it.

**Registration collects sacraments/league too — as a claim, not a fact.**
Register (and "Add Child") now also ask "already baptised?", "already
confirmed?", and which league someone already belongs to. This does **not**
set `baptised`/`confirmed`/`league` directly — it creates the same
`pending_baptism` / `pending_confirmation` / `pending_league` request an
existing member would submit from their portal, so it still needs an admin to
confirm it before it counts (same rule explained above: nobody can hand
themselves a sacramental record just by typing into a form). Answering "already
confirmed" without "already baptised" is rejected client-side and dropped
server-side too, since confirmation always follows baptism.

**Baptism, confirmation, and league requests are now real application forms,
signed.** Requesting baptism asks for the type (Infant/Adult) and a
sponsor/godparent name; requesting confirmation asks for a mentor; requesting a
league asks why. All three now require a drawn signature — draw with your
finger (native) or mouse (web) in `components/signature-pad.native.tsx` /
`signature-pad.web.tsx` — before the request can be submitted, at registration,
from the portal, and for a child in the household. Admins see the answers and a
thumbnail of the signature right next to each pending request in **Members**,
not just a bare "wants to join X" line.

The signature pad is two separate files rather than one file with a
`Platform.OS` check: `react-native-view-shot` (used to snapshot the on-screen
drawing into a PNG on native) has no web build, and Metro resolves
`signature-pad` to whichever platform file exists at bundle time — so the web
bundle never even sees that import, rather than merely skipping it at runtime.
This needed one extra tsconfig setting (`moduleSuffixes`) since Expo's default
config doesn't teach plain `tsc` about that convention the way Metro already
knows it.

Answers and the signature are stored as `jsonb` (`baptism_application` /
`confirmation_application` / `league_application` on both `profiles` and
`dependents`) — a signature is a small enough image that storing it inline was
simpler than standing up Supabase Storage for it. Both are cleared once an
admin approves or denies the request; they're for reviewing *this* pending
request, not a permanent record of who someone's godparent was.

> **Native signature capture isn't verified against a real device.** The web
> canvas is standard-issue HTML5 and low-risk. The native path — react-native-svg
> + PanResponder + react-native-view-shot — is the conventional way to build this
> in React Native, but I can't confirm it behaves in Expo Go here. Smoke-test
> drawing and submitting a signature on an actual phone before relying on it.

**Certificate photos, for confirmation and league requests.** Requesting
confirmation can attach a baptism certificate "if applicable" — mainly for
someone baptised elsewhere, where the parish has no record of their own to go
on. Requesting a league can attach both a baptism *and* a confirmation
certificate, since league membership generally assumes both. Neither is a hard
requirement (nothing here blocks submission if you don't have one to hand) —
they're supporting evidence for whoever reviews the request.

`components/certificate-picker.tsx` uses `expo-image-picker` to choose or
photograph an image, then `expo-image-manipulator` to resize it down (~1000px
wide, JPEG) before it's stored as a data URI the same way a signature is —
without that resize step a full-resolution phone photo would be several MB,
too big to store inline this way. Unlike the signature pad, this one didn't
need a `.native`/`.web` split: both underlying packages have real web
support, confirmed by checking their source rather than assuming it.

**Password reset.** "Forgot your password?" on the sign-in screen sends a reset
link via Supabase Auth. Clicking it re-opens the app (native) or the site (web) at
a dedicated screen to set a new password — no separate email server to configure,
Supabase sends it. Requires the redirect URLs from step 4 above to be set.

**Account removal is honest about its blast radius.** Removing a member can only
ever delete their `profiles` row — the app has no access to delete the underlying
Supabase Auth account, by design (that needs service-role access, which the
client deliberately never has). If a removed member tries to log back in with
their old password, they land on a clear "Account Not Found" screen instead of a
stuck loading spinner. And since children are registered under a guardian,
removing an adult who has kids in the household now warns you by name before it
cascades and removes them too.

**A light audit trail.** Every league/baptism/confirmation approval or denial now
stamps who reviewed it and when (`reviewed_by`, `reviewed_at` on `profiles` and
`dependents`) — shown as "Last reviewed …" in the edit screens. It's a
last-action marker, not a full history log of every past decision, but it beats
having no record at all of who approved what.

> If you already ran an earlier version of this migration against a live Supabase
> project (before birthdays/children/gender existed), `0001_init.sql` will now fail
> partway through with "relation already exists" — `create table` isn't safe to
> re-run as-is. With no real member data yet, the simplest fix is to wipe and
> start over: in the SQL Editor, run `drop schema public cascade; create schema
> public;`, then run the full `0001_init.sql` fresh. If you do have real data you
> need to keep, don't run that drop — ask for an incremental migration instead
> (just the new columns/tables/functions you're missing) rather than the whole
> file.

## Project layout

```
app/
  index.tsx                        — landing page (signed out) or redirect to portal/dashboard (signed in)
  login.tsx, register.tsx, reset-password.tsx — public screens
  (app)/_layout.tsx               — tab bar; hides admin-only tabs from members
  (app)/portal.tsx                — member home: profile, requests, parish stats
  (app)/dashboard.tsx             — admin home: stats + announcements CRUD
  (app)/members.tsx               — admin: registry, search/filter, approvals, edit
  (app)/banking.tsx               — shared: account details & payment references
lib/
  supabase.ts                     — Supabase client
  auth-context.tsx                — session + profile React context
  types.ts                        — shared TypeScript types
  church-calendar.ts              — Easter/Lent/Advent/etc. date math
  liturgical-theme.ts             — today's liturgical season → accent colour
components/
  ui.tsx                          — shared UI kit (Card, Chip, BarRow, SelectField…)
  church-header.tsx               — crest + seasonal ring, used on every public screen
  landing-page.tsx                — the signed-out landing page
  league-badge.tsx                — real badge artwork for the 3 leagues that have any
  signature-pad.native.tsx / .web.tsx — drawn-signature capture, split by platform on purpose
  certificate-picker.tsx          — attach a baptism/confirmation certificate photo
assets/brand/                     — church crest + league badges, scanned from the parish's own bulletins
theme.ts                          — colours (sampled from the real crest), wards, leagues, liturgical palette
supabase/migrations/0001_init.sql — full database schema + security policies
```

## Publishing the website (Vercel)

`vercel.json` is already set up: it builds with `npx expo export --platform web`
into `dist/` (a plain static site — HTML/JS, no server required) and rewrites every
path to `index.html` so client-side routes like `/login` or `/(app)/members` work
on a hard refresh or a direct link.

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com), **New Project** → import the repo. Vercel
   will detect `vercel.json` and use it as-is — no framework preset needed.
3. Under **Environment Variables**, add `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` (same values as your local `.env`). These are
   baked in at build time, so they must be set *before* you deploy, not after.
4. Deploy. Vercel gives you a `https://your-project.vercel.app` domain (or attach
   your own).
5. Back in Supabase → **Authentication → URL Configuration**, add
   `https://your-project.vercel.app/**` to **Redirect URLs** (see step 4 above) —
   otherwise the "Forgot password?" email link will be rejected on the live site.

Since login and every data call go straight to your Supabase project from the
browser, there's nothing else to deploy — no API routes, no server to manage. To
preview the production build locally first: `npm run build:web && npx serve dist`.

## Publishing to the App Store / Play Store

When you're ready to ship beyond Expo Go, use [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npx eas-cli build --platform all
```

This is a separate, later step — it needs a (free) Expo account and, for App Store
submission specifically, a paid Apple Developer account. None of that is required
just to use and test the app today, and it's entirely independent of the website —
you can ship the web version without ever touching EAS.
