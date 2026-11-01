# Test accounts

Fictional people covering every role and situation in the app, so you can try anything
without touching real members. Every name, phone number and `@example.com` email is made up.

**Password for every account: `TestPass123!`**

> These accounts exist only in a **development database** you create on your own computer. They are
> **not** on the live site. Never run the seed against a database that holds real members:
> it would add fake people to the registry and distort the counts.

## Create them

You need Docker Desktop running, then, in the project folder:

```bash
npx supabase start               # starts a local copy of the database
npx supabase db reset            # (optional) empties it and re-applies every migration
node scripts/seedTestAccounts.mjs
```

The script finds your local database by itself and **refuses to run against anything else**.
Then run the app against it: put the local address and key from `npx supabase status` in
`.env` (`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the `ANON_KEY` it prints), and `npm run web`.
Using the app changes the data (approving a request, for example), so run `db reset` and the seed again
whenever you want a clean slate.

## Who is who

| Email | Name | What they are | What to try with them |
|---|---|---|---|
| `admin@example.com` | Lindiwe Mthembu | **Congregation admin** (Central ward) | Everything on the office side: [dashboard & registry](guides/06-admin-dashboard-and-registry.md), [requests & families](guides/07-admin-requests-and-families.md), [announcements & leagues](guides/08-admin-announcements-and-leagues.md), [settings](guides/09-admin-congregation-settings.md) |
| `admin2@example.com` | Johan Botha | A second admin (North) | Promote/remove admins; see that two admins share one registry |
| `member@example.com` | Thandi Mokoena | **Established member** (East). Baptised, confirmed, in the Prayer Women's League; a teacher, so she is in the directory; mother of three children | The full [member portal](guides/02-your-portal.md), [household](guides/03-family-and-household.md), all three [certificates](guides/04-certificates.md) |
| `newmember@example.com` | Sipho Dlamini | **New member** (West) with no sacraments | Has a pending **baptism** request and a pending **league** request, so the office has something to review |
| `youth@example.com` | Kagiso Mahlangu | **Youth** (b. 2007), Prayer Youth League, baptised | Has a pending **confirmation** request; ideal for the [schedule → accept date flow](guides/07-admin-requests-and-families.md#scheduling-a-ceremony) |
| `leagueadmin@example.com` | Nomsa Khumalo | A member who is also **league admin** of the Prayer Youth League | The [My League tools](guides/08-admin-announcements-and-leagues.md#what-a-league-admin-sees) |
| `elder@example.com` | Pieter van Wyk | **Elder** (b. 1951), Prayer Men's League | The elders count on the dashboard |
| `relative@example.com` | Zanele Mokoena | Has Thandi's surname and ward | Registration matched her into Thandi's family and flagged it, so the admin's **Families → Needs Review** list has an entry |
| `inactive@example.com` | Tebogo Molefe | Has not been active for ~130 days and has told the app he has left | The admin **Activity** filters, including *Says they've left* |
| `birthday@example.com` | Ayanda Zulu | Her birthday is **today** (the day you seed) | The [birthday greeting](guides/02-your-portal.md#birthday-greeting) |
| `member1@example.com` … `member6@example.com` | Mpho Nkosi, Karabo Sithole, Naomi Pretorius, David Naidoo, Grace Adeyemi, Lungile Ndlovu | Ordinary members spread across wards and leagues, last active 12–100 days ago (one never) | Registry search and filters; `member2` (Karabo) has no baptism so can **request** it; `member3` (Naomi) has been away long enough to see the yearly [check-in question](guides/02-your-portal.md#the-yearly-check-in) |

Also created for you:

- **Three children** under Thandi: Lwazi (a pending baptism request), Naledi, and Amahle (already baptised, with details on record).
- **Three announcements** (two for the whole church, one for the Prayer Youth League) and **two calendar events**.
- **Certificate details** for baptism (Thandi) and for the Prayer Youth and Prayer Women's leagues. The Prayer Women's League deliberately has **no verse**, so its certificate shows the default one.
- A **SnapScan merchant code** (`demoparish`), so the *Pay with SnapScan* button is switched on. No real payment can happen.
- The two bank accounts and payment reference codes come from the database setup itself.

## A note about the special admin

On a real installation, the account registered with `tshikovhitshedza9@gmail.com` is made an admin automatically (see
[DEPLOYMENT.md](DEPLOYMENT.md#2-the-first-admin)). The test data does not create that account; use `admin@example.com`.
