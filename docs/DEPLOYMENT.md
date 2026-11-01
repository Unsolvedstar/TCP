# Deployment & operations

For whoever hosts and looks after the app. You do not need to be a programmer for
most of this, but you do need the project owner's logins. **Never paste a password,
key or token into a chat, ticket or file in this repository.**

## Where everything lives

| What | Where | Notes |
|---|---|---|
| Code | GitHub: `Unsolvedstar/TCP`, branch `main` | Every push to `main` is built by CI |
| Website | Vercel project → https://tcp-tau.vercel.app | Builds automatically from `main` |
| Database, sign-in, SnapScan webhook | Supabase project `fqfhgntmhjsfrdjozalc` (region `eu-west-1`, Ireland) | Dashboard: https://supabase.com/dashboard/project/fqfhgntmhjsfrdjozalc |

Two values connect the website to the database. Both are **public by design** (the
database's own rules protect the data) and are set as environment variables on Vercel:

- `EXPO_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase → Project Settings → API → *anon / public*

They are baked into the site when it is **built**, so changing one needs a redeploy.

---

## 1. Set up a new Supabase project

Only needed for a new parish/installation, or if the old project is gone.

1. Create a project at supabase.com (free tier is fine; pick a region near you).
2. Copy the **Project URL** and **anon key** (Project Settings → API).
3. Apply the database. On a computer with the code and Node installed:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   This applies all 31 migrations in `supabase/migrations/` in order. Check it worked:
   ```bash
   npx supabase migration list --linked     # every row should show the same number locally and remotely
   ```
4. In the dashboard, **Authentication → Providers → Email**:
   - leave **Confirm email OFF** — the app sends no email, so new sign-ups must be able to log in immediately;
   - set **Minimum password length** to **8** (the app already requires 8; this makes the server agree).
   No redirect URLs are needed.
5. Open the website and register the first account (see §2).

## 2. The first admin

- The account registered with **`tshikovhitshedza9@gmail.com`** is made an admin
  automatically and cannot be demoted (migration `0030`). **This is tied to that email
  address.** If that account were ever deleted, whoever registered the same address next
  would become admin — so don't delete it, and keep control of the mailbox.
- Any other admin is made in the app: **Members → open a person → Edit → Promote to Admin**.
- For a different owner/parish, either promote in the app once any admin exists, or in
  Supabase → SQL Editor:
  ```sql
  update public.profiles set role = 'admin' where id = '<that user''s id>';
  ```
  (the id is under Authentication → Users). A new migration can replace `0030`'s email.

## 3. Publish the website (Vercel)

1. vercel.com → **Add New → Project** → import the GitHub repository.
2. Leave the framework preset alone: `vercel.json` already sets the build command
   (`npx expo export --platform web`), the output folder (`dist`), the single-page rewrite
   and the security/caching headers.
3. Under **Environment Variables** add the two `EXPO_PUBLIC_…` values above, then **Deploy**.
4. Optional: attach your own domain (Project → Settings → Domains).

From then on, **pushing to `main` redeploys the site**. Members who installed the app
get the new version the next time they open it — fully close and reopen it (sometimes
twice) because the browser keeps the old copy for a moment.

HTTPS is required for installing the app; Vercel provides it.

### Installing it as an app (PWA)
Nothing to publish in an app store. Members open the website and:
- **Android / desktop Chrome, Edge:** tap **Install the app** (or the browser's install icon).
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**.

An installed iPhone app keeps its own storage, so members sign in again after installing.
To force every device to drop its saved copy, change `VERSION` in `public/sw.js` and deploy.

## 4. SnapScan giving (optional)

Giving through SnapScan needs a SnapScan **merchant account** (snapscan.co.za; help@snapscan.co.za).

1. Sign in as an admin → **Members → Congregation Settings → SnapScan Checkout** → enter the
   merchant code → **Save**. Until it is set, the *Pay with SnapScan* button is disabled.
2. Deploy the webhook that records payments. **It must be deployed without Supabase's
   login-token check**, because SnapScan's servers cannot send one — the function verifies
   SnapScan's own signature instead:
   ```bash
   npx supabase functions deploy snapscan-webhook --no-verify-jwt
   npx supabase secrets set SNAPSCAN_WEBHOOK_AUTH_KEY=<key from SnapScan support>
   ```
   Until the key is set the function answers `503` and records nothing (it fails closed).
3. Give SnapScan this address to send payment notices to:
   `https://<project-ref>.functions.supabase.co/snapscan-webhook`

> Status when this was written: the function is deployed, but with the login-token check
> **on** (the default). Redeploy it with `--no-verify-jwt` as above before going live with SnapScan.

## 5. Logins for each league (optional)

`scripts/createLeagueAdminAccounts.mjs` creates a generic login per league that is already
that league's admin, so a league doesn't need a real member's account. It needs the
**service-role key** (Supabase → Project Settings → API) — a powerful secret; keep it in a
local `.env.service.local` file (already git-ignored) and never commit it. Full steps are
at the top of the script. The passwords are printed once; store them in a password manager.

## 6. Day-to-day operations

### Resetting a member's password
There is no email reset. The member asks the parish office. With the Supabase **SQL Editor**:
```sql
update auth.users
set encrypted_password = crypt('SomeTempPass1', gen_salt('bf'))
where email = 'member@example.com';
```
Give them the temporary password and ask them to sign in. (This is the usual way to set a
password directly; try it on a test account before relying on it.) Enter the real email carefully —
the statement changes whichever account matches.

### Removing someone completely
**Remove From Registry** in the app deletes their profile but not their sign-in account.
If they should be able to register again with the same email, also delete them under
Supabase → Authentication → Users.

### Changing the database
Add a new numbered file in `supabase/migrations/` (never edit an old one), try it locally
(`npx supabase db reset`, then the security tests in the README), then `npx supabase db push`.
Afterwards update the [database diagram](ERD.md). To refill a local database with fictional people, see [Test accounts](TEST_ACCOUNTS.md).

### Free projects pause themselves
On Supabase's free plan a project with no activity for about a week is **paused** — the
website still loads, but nothing signs in or loads data, and the database address stops
resolving. This happened once already.
- **Fix:** Supabase dashboard → the project → **Restore project** (a few minutes).
- **Avoid it:** the parish being active is usually enough; a paid plan removes pausing.

### Backups
Check what your Supabase plan includes — the free plan does not take automatic backups as far
as we know. Take your own copy regularly (needs Docker Desktop running):
```bash
npx supabase db dump --linked -f backup.sql
```
This covers the app's tables. Sign-in accounts live in Supabase's separate `auth` area, which
this does not include (see Supabase's backup documentation). Keep backups somewhere private.

## 7. Security checklist

- [ ] Email confirmation is **off** and minimum password is **8** (§1.4).
- [ ] `.env`, `.env.service.local` and keys are never committed (they are git-ignored).
- [ ] The service-role key is used only for the league-logins script and kept off shared machines.
- [ ] The privacy policy (`/privacy`) names the parish's Information Officer and has been approved.
- [ ] The SnapScan webhook has its signature key set before SnapScan goes live.
- [ ] Admins are few, and removed when they step down (Members → Admins → Remove Access).

## 8. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Page is blank, or says *Missing EXPO_PUBLIC_SUPABASE_URL* | The two environment variables weren't set when the site was built. Set them on Vercel and redeploy. |
| Site loads but sign-in or data never works, or *Failed to fetch* | The Supabase project is paused — restore it (§6). |
| No **Install the app** button | Needs HTTPS and a browser that supports installing; it hides once installed. On iPhone use Share → Add to Home Screen. |
| Members still see the old version | Close the app fully and reopen (twice if needed); or bump `VERSION` in `public/sw.js`. |
| *Pay with SnapScan* is disabled | No merchant code yet (§4). |
| *Account Not Found* after signing in | That person was removed from the registry. Delete the old sign-in under Authentication → Users so they can register again. |
| A member can't sign in | Reset their password (§6). |
| *Could not create your account* when registering | The database refused the details (e.g. a ward or league that doesn't belong to the chosen congregation) or an email already in use. Check all migrations are applied (`migration list --linked`). |
| A certificate download looks wrong | Save/share it again; on the web it is rendered at 3×. If it persists, note the browser and screen and report it. |
