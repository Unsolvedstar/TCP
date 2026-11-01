# Documentation

Everything about the ELCSA Tshwane City Parish app, split into separate documents so you can read only what you need.
Screenshots show the real app running on **fictional test data** — none of the people in them are real.

## The app has five "sides"

| Side | Who | Where to start |
|---|---|---|
| **Visitor** | Anyone, not signed in | [Visitors, registering and signing in](guides/01-visitors-and-getting-started.md) |
| **Member** | A signed-in parishioner | [Your portal](guides/02-your-portal.md) |
| **Parent** | A member with children, or relatives | [Family and household](guides/03-family-and-household.md) |
| **League admin** | A member who runs one league | [Announcements, events and leagues](guides/08-admin-announcements-and-leagues.md) |
| **Office admin** | The parish office | [Dashboard and registry](guides/06-admin-dashboard-and-registry.md) |

## User guides

For the people who use the app. Plain language, with a screenshot for each screen.

| # | Guide | Covers |
|---|---|---|
| 1 | [Visitors, registering and signing in](guides/01-visitors-and-getting-started.md) | Front page, "Just Visiting", choosing a congregation, the four-step registration, signing in, the privacy policy |
| 2 | [Your portal](guides/02-your-portal.md) | Status cards, yearly check-in, birthday greeting, My Details, requesting baptism / confirmation / a league, accepting a ceremony date, leagues and calendar |
| 3 | [Family and household](guides/03-family-and-household.md) | Family codes, joining a relative's family, registering and managing children |
| 4 | [Certificates](guides/04-certificates.md) | Baptism, confirmation and league certificates: what is on them, where each detail comes from, saving and printing |
| 5 | [Parish life](guides/05-parish-life.md) | Announcements, calendar and birthdays, the member directory, banking details and SnapScan giving |
| 6 | [Admin: dashboard and registry](guides/06-admin-dashboard-and-registry.md) | Parish numbers, the registry, profiles, editing, children, activity, admins |
| 7 | [Admin: requests, ceremonies and families](guides/07-admin-requests-and-families.md) | Reviewing requests, scheduling a ceremony date, the member's acceptance, family codes and matching |
| 8 | [Announcements, events and leagues](guides/08-admin-announcements-and-leagues.md) | Posting news and events, league admins and their tools, certificate details |
| 9 | [Congregation settings, banking and giving](guides/09-admin-congregation-settings.md) | Branding, SnapScan, wards, leagues, bank accounts, payment codes |
| 10 | [Phone, computer and installing](guides/10-phone-desktop-and-install.md) | The two layouts, installing on Android / iPhone / computer, offline use, updates, accessibility |

## For whoever looks after the app

| Document | Covers |
|---|---|
| [Deployment & operations](DEPLOYMENT.md) | Setting up Supabase and Vercel, the first admin, SnapScan, backups, password resets, the database pausing, troubleshooting |
| [Test accounts](TEST_ACCOUNTS.md) | Fictional accounts for every role and situation, and how to create them in a development database |

## For developers

| Document | Covers |
|---|---|
| [Architecture](ARCHITECTURE.md) | How it fits together: roles, the security model, the app's structure, conventions |
| [Database diagram (ERD)](ERD.md) | All 14 tables with their columns and relationships, and a diagram |
| [README](../README.md) | Running it locally, commands, project layout |
| [NOTES](../NOTES.md) | The running to-do list |

## About the screenshots

They were taken from the real app built against a local development database filled by `scripts/seedTestAccounts.mjs`, on a phone-sized window (390 px wide) and a computer-sized window (1280 px wide). The names, phone numbers and email addresses are made up.
Screens change as the app does; if you rename a button, update the guides that mention it.
