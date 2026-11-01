# Admin guide — parish office

For the people who run the parish's records. You do not need to be technical.
Members have their own shorter [Member guide](MEMBER_GUIDE.md).

You are looking after other people's personal information — names, birthdays,
children, certificates. Open only what you need for the task, and don't share
screenshots of the registry outside the office.

## Signing in

Go to the app and sign in with your email and password. As an admin you see six
tabs (on a phone along the bottom, on a computer down the left):

| Tab | What it is for |
|---|---|
| **Dashboard** (*Home* on a phone) | Live numbers for the whole parish |
| **Members** | The registry, requests, families and settings |
| **Announcements** (*News* on a phone) | Post news and events |
| **Directory** | Members who've shared their profession |
| **Banking** | The parish's accounts and giving |
| **Leagues** | Tools for each league |

## The Dashboard

The top banner shows how many **people are in the church** (adults, elders and children).
Under it, switch between **Dashboard**, **Leagues** and **Calendar**:

- **Dashboard** — a card for each ward with its count, then breakdowns by ward, gender and sacrament. Tap a breakdown to open it.
- **Leagues** — how many belong to each league.
- **Calendar** — the church year (Lent, Easter, Pentecost, Advent…, worked out automatically), your announcements and events, and **upcoming birthdays**.

If requests are waiting, a yellow **"n pending requests — Review →"** bar appears at the top.

## The registry (Members)

At the top, **Congregation Registry** shows how many members, dependents and families you have.
Use the four buttons to switch view:

- **Members** — adults. Search by name, phone, email, profession or family; filter by **ward** and by **league / organisation**.
- **Dependents** — children registered under a parent.
- **Families** — family codes and matching (see below).
- **Activity** — who has been active. Filters: *All*, *60+ days*, *90+ days*, *Never logged in*, *Says they've left*.

### Looking at and changing a person
Tap a member to open their profile: contact details, family, sacraments, league, certificates and activity.
There is a **Message on WhatsApp** button if they've given a phone number.

Press **Edit** to change their name, phone, birthday, gender, ward, league or family. Tapping a **dependent**
opens their edit screen directly. Work through the steps and press **Save Changes** at the end.

### Requests (Pending Requests)
When a member asks for **baptism**, **confirmation**, or to **join a league**, it appears in
**Pending Requests** with what they entered (sponsor, mentor, reason, any certificate photos).
You then choose:

1. **Schedule** — pick the ceremony date and press **Send Date**. The member (or a child's parent) is asked
   "Does this date work?".
2. If they answer **Yes, that works**, the request completes by itself: the member's record is updated and an
   entry for that ceremony is added to the church calendar. If they answer **Needs a different date**, it comes back to you.
3. **Deny** — declines the request straight away.

Leagues are also handled by that league's own admins (see below).

### Families
A family is a group of people on one household record. In the **Families** view:

- **Family Codes → Generate 20 Codes.** Codes are optional. Registration already places people
  in a family automatically (same ward and surname). A code lets someone join a *specific* family later.
- **Needs Review** — matches the app made automatically. For each, press **Confirm** if they really are one
  family, or **Split Off** to put the person in their own new family.
- **Unassigned** — people not yet in any family.

Members can also rename their own family and manage who is in it from their portal.

### Admins
- To make someone an admin: open them → **Edit** → **Promote to Admin**.
- To remove an admin: **Members** tab → the **Admins** section → **Remove Access**. You can't remove the last admin.
- Keep the number of admins small.

### Removing someone
Open them → **Edit** → **Remove From Registry**. This deletes their record, and **their children too** (the app
warns you by name first). It does *not* delete their sign-in; see "Forgotten passwords and re-registering" below.

## Certificates

Members download their own certificates from their portal (**View Certificate**), once the sacrament or league
membership is recorded. Every certificate prints a **Bible verse**: if you haven't chosen one, a default is used.

**Baptism certificates** need a few details from you. Open the person → **Edit Certificate Details** and fill in
the register number, diocese, parents, place of birth, and (optionally) a verse. A reference like `Psalm 25:1-3`
plus **Look Up** fills in the verse text (World English Bible); you can also type your own.
Date of birth, date and place of baptism, the officiant and the sponsor come from what was already recorded.

**League certificates** use the league's own details (see below). **Confirmation certificates** need nothing extra.

## Announcements and events

**Announcements** tab → **New Announcement**: a title, an optional date ("Sunday 31 October, 09:00"), optional
details and an optional poster image, and **Who should see this?** — the whole church or one league.
Press **Post Announcement**. Posted items are listed below and can be removed. Members can have an announcement
read aloud with the **Listen** button.

League admins can post church-wide, too.

## Leagues

Each league has its own admins who see a **My League** tab (you, as a congregation admin, see **Leagues** with every league):

- **Pending Join Requests** — **Schedule** (installation date) / **Deny**, same as above.
- **Post an Event** — title, date, details, and who should see it.
- **Certificate Details** — the **Chairperson Name** and **Parish Pastor Name** printed on installation
  certificates, and the league's Bible verse. **Save Certificate Details** when done.

To make a member a league admin: open them → **Edit** → under **League admin access**, tap the leagues they should
manage. The **League Admins** section on the **Members** tab lists who currently has access, with a **Remove** button.
The office can also create a generic login per league — see [DEPLOYMENT.md](DEPLOYMENT.md) §5.

## Congregation settings

**Members → Congregation Settings** (admins only):

- **Branding** — name, tagline, address, colours and logo.
- **SnapScan Checkout** — the merchant code that turns on the *Pay with SnapScan* button.
- **Wards** and **Leagues** — add, edit or remove. A league can be marked as having badge artwork.
- **Bank accounts** and **payment reference codes** — shown to every member on the **Banking** tab, with a
  copy button on the account number and codes.

Removing a ward or league that people belong to can affect them — check first.

## Forgotten passwords and re-registering

The app sends **no emails**, so there is no "reset my password" link. When a member forgets their password they ask
you, and whoever looks after the system sets a temporary one (steps in [DEPLOYMENT.md](DEPLOYMENT.md) §6).
Tell the member to sign in with it and keep it private. Passwords must be at least 8 characters.

If you removed someone from the registry and they should be able to register again, their old sign-in must be
deleted too (DEPLOYMENT.md §6) — otherwise they see *Account Not Found*.

## Giving (Banking tab)

Members see the parish's accounts and **payment reference codes** (for example *PLG – Pledge & Tithe*) so
their deposit reaches the right place. If SnapScan is set up they can also pay in the app: they choose an amount and what
it is for, and SnapScan opens to confirm. Payments are recorded automatically once SnapScan confirms them.

## Good practice

- Check **Pending Requests** weekly so members aren't left waiting.
- Use **Activity → Says they've left** and *90+ days* to tidy the registry. Once a year each member is asked whether they
  are still part of the parish; those who say they have left appear under *Says they've left*.
- Keep a regular backup of the database (see DEPLOYMENT.md §6).
- If a member asks what the app knows about them, show them their own portal, and see the privacy policy at `/privacy`.
