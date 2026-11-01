// Seeds a DEVELOPMENT database with fictional test accounts and sample data, one for
// every role and state in the app — for trying things out and for taking documentation
// screenshots. Everything here is made up (names, phone numbers, @example.com emails).
//
//   npx supabase start
//   npx supabase db reset           # optional: start from an empty database
//   node scripts/seedTestAccounts.mjs
//
// It talks to your LOCAL Supabase (found with `npx supabase status`) and refuses to touch
// anything else. Pointing it at a real project would add fake people to the live registry
// and skew its counts; that is only possible by setting ALLOW_REMOTE_SEED=1 together with
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — don't do that on a project with real members.
//
// Every account uses the same password, TEST_PASSWORD below. See docs/TEST_ACCOUNTS.md.

import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

export const TEST_PASSWORD = 'TestPass123!'

function credentials() {
  if (process.env.ALLOW_REMOTE_SEED === '1') {
    const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env
    if (!url || !key) throw new Error('ALLOW_REMOTE_SEED needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    return { url, key }
  }
  let status
  try {
    status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
  } catch {
    throw new Error('Local Supabase is not running. Start it with `npx supabase start`.')
  }
  const url = status.API_URL ?? status.api_url
  const key = status.SERVICE_ROLE_KEY ?? status.service_role_key
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(url)) throw new Error(`Refusing to seed a non-local database (${url}).`)
  return { url, key }
}

const { url, key } = credentials()
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: WebSocket } })

const iso = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString()
const daysAhead = (n) => iso(new Date(Date.now() + n * 86400000))
// A birthday that falls on today's date, `age` years ago.
const birthdayToday = (age) => `${today.getFullYear() - age}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const { data: cong } = await db.from('congregations').select('id').limit(1).single()
const { data: wards } = await db.from('wards').select('id,name').eq('congregation_id', cong.id)
const { data: leagues } = await db.from('leagues').select('id,key,label').eq('congregation_id', cong.id)
const ward = (name) => wards.find((w) => w.name === name)?.id ?? wards[0].id
const league = (k) => leagues.find((l) => l.key === k)?.id ?? null

async function mk(email, fullName, wardName, extra = {}) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName, congregation_id: cong.id, ward_id: ward(wardName), ...extra },
  })
  if (error) throw new Error(`${email}: ${error.message}`)
  return data.user.id
}
const must = ({ data, error }, what) => { if (error) throw new Error(`${what}: ${error.message}`); return data }
const patch = (id, fields) => db.from('profiles').update(fields).eq('id', id).then(({ error }) => { if (error) throw new Error(error.message) })

// ---- People -------------------------------------------------------------
const admin = await mk('admin@example.com', 'Lindiwe Mthembu', 'Central', { phone: '0821110001', date_of_birth: '1978-06-21', gender: 'Female', already_baptised: true, already_confirmed: true })
await patch(admin, { role: 'admin', profession: 'Parish Administrator' })
const admin2 = await mk('admin2@example.com', 'Johan Botha', 'North', { phone: '0821110002', date_of_birth: '1969-11-02', gender: 'Male', already_baptised: true, already_confirmed: true })
await patch(admin2, { role: 'admin' })

const thandi = await mk('member@example.com', 'Thandi Mokoena', 'East', {
  phone: '0821110003', date_of_birth: '1985-03-14', gender: 'Female', league_id: league('PrayerWomens'),
  already_baptised: true, already_confirmed: true, baptism_type: 'adult', sponsor_name: 'Rebecca Sithole',
  baptism_location: 'Tshwane City Parish', baptism_officiant: 'Rev. Daniel Ferreira', mentor_name: 'Grace Pretorius',
  confirmation_location: 'Tshwane City Parish', confirmation_officiant: 'Rev. Daniel Ferreira',
})
await patch(thandi, { profession: 'Teacher' })

const sipho = await mk('newmember@example.com', 'Sipho Dlamini', 'West', { phone: '0821110004', date_of_birth: '1994-09-30', gender: 'Male' })
const nomsa = await mk('leagueadmin@example.com', 'Nomsa Khumalo', 'South', { phone: '0821110005', date_of_birth: '1990-01-17', gender: 'Female', league_id: league('PrayerYouth'), already_baptised: true, already_confirmed: true })
await patch(nomsa, { profession: 'Youth Worker' })
const pieter = await mk('elder@example.com', 'Pieter van Wyk', 'North', { phone: '0821110006', date_of_birth: '1951-08-09', gender: 'Male', league_id: league('PrayerMens'), already_baptised: true, already_confirmed: true })
await patch(pieter, { profession: 'Retired Engineer' })
const kagiso = await mk('youth@example.com', 'Kagiso Mahlangu', 'Central', { phone: '0821110007', date_of_birth: '2007-04-25', gender: 'Male', league_id: league('PrayerYouth'), already_baptised: true })
// Same surname and ward as Thandi → the app matches her into Thandi's family and flags it for review.
const zanele = await mk('relative@example.com', 'Zanele Mokoena', 'East', { phone: '0821110008', date_of_birth: '1992-12-05', gender: 'Female' })
const tebogo = await mk('inactive@example.com', 'Tebogo Molefe', 'South', { date_of_birth: '1988-02-11', gender: 'Male', already_baptised: true })
await patch(tebogo, { last_active_at: daysAgo(130), self_reported_left_at: daysAgo(10) })
const ayanda = await mk('birthday@example.com', 'Ayanda Zulu', 'West', { phone: '0821110009', date_of_birth: birthdayToday(32), gender: 'Female', already_baptised: true, already_confirmed: true })

const filler = [
  ['Mpho Nkosi', 'Central', 'Male', 'YoungAdults', 30], ['Karabo Sithole', 'East', 'Female', 'YoungAdults', 70], ['Naomi Pretorius', 'North', 'Female', 'PrayerWomens', 100],
  ['David Naidoo', 'South', 'Male', 'ELCSAMO', 12], ['Grace Adeyemi', 'West', 'Female', 'PrayerWomens', 55], ['Lungile Ndlovu', 'Central', 'Male', 'PrayerMens', null],
]
for (const [i, [name, w, g, lg, lastSeen]] of filler.entries()) {
  const id = await mk(`member${i + 1}@example.com`, name, w, { date_of_birth: `19${72 + i * 3}-0${1 + i}-1${i}`, gender: g, league_id: league(lg), already_baptised: i % 2 === 0, already_confirmed: i % 3 === 0 })
  await patch(id, { last_active_at: lastSeen === null ? null : daysAgo(lastSeen), ...(i % 2 === 0 ? { profession: ['Accountant', 'Nurse', 'Electrician'][i / 2] } : {}) })
}

// ---- A household with children (Thandi) ----------------------------------
const kids = must(await db.from('dependents').insert([
  { guardian_id: thandi, full_name: 'Lwazi Mokoena', date_of_birth: '2015-05-04', gender: 'Male', ward_id: ward('East'), baptised: false, baptism_application: null },
  { guardian_id: thandi, full_name: 'Naledi Mokoena', date_of_birth: '2018-11-20', gender: 'Female', ward_id: ward('East'), baptised: false, baptism_application: null },
  { guardian_id: thandi, full_name: 'Amahle Mokoena', date_of_birth: '2021-02-10', gender: 'Female', ward_id: ward('East'), baptised: true,
    baptism_application: { type: 'infant', sponsor_name: 'Rebecca Sithole', location: 'Tshwane City Parish', officiant_name: 'Rev. Daniel Ferreira', submitted_at: daysAgo(400) } },
]).select('id,full_name'), 'dependents')
const lwazi = kids.find((k) => k.full_name.startsWith('Lwazi')).id

// ---- Pending requests (what the office reviews) ---------------------------
const now = new Date().toISOString()
await patch(sipho, { pending_baptism: true, baptism_application: { type: 'adult', sponsor_name: 'Mpho Nkosi', note: 'I would like to be baptised this year.', submitted_at: now } })
await patch(sipho, { pending_league_id: league('PrayerMens'), league_application: { reason: 'My father was a member and I would like to serve.', submitted_at: now } })
await patch(kagiso, { pending_confirmation: true, confirmation_application: { mentor_name: 'Nomsa Khumalo', submitted_at: now } })
must(await db.from('dependents').update({ pending_baptism: true, baptism_application: { type: 'infant', sponsor_name: 'Zanele Mokoena', submitted_at: now } }).eq('id', lwazi), 'dependent request')

// ---- Certificate details --------------------------------------------------
const { data: tp } = await db.from('profiles').select('baptism_application').eq('id', thandi).single()
await patch(thandi, {
  baptism_application: { ...(tp.baptism_application ?? {}), register_no: '07/03/12', diocese: 'Central Diocese', parents: 'Joseph & Beauty Mokoena', birth_place: 'Pretoria',
    verse_reference: 'Psalm 25:1-3 WEB', verse_text: 'To you, Yahweh, I lift up my soul. My God, I have trusted in you. Don’t let me be put to shame. Don’t let my enemies triumph over me.' },
})
must(await db.from('leagues').update({ chairperson_name: 'Ruth Mabaso', pastor_name: 'Rev. Daniel Ferreira', verse_reference: 'Romans 12:2 WEB',
  verse_text: 'Don’t be conformed to this world, but be transformed by the renewing of your mind, so that you may prove what is the good, well-pleasing, and perfect will of God.' }).eq('id', league('PrayerYouth')), 'league details')
must(await db.from('leagues').update({ chairperson_name: 'Beauty Zondi', pastor_name: 'Rev. Daniel Ferreira' }).eq('id', league('PrayerWomens')), 'league details 2') // no verse on purpose → shows the default

// ---- League admin, posts, SnapScan ----------------------------------------
must(await db.from('league_admins').insert({ profile_id: nomsa, league_id: league('PrayerYouth') }), 'league_admins')
must(await db.from('announcements').insert([
  { congregation_id: cong.id, created_by: admin, title: 'Reformation Day Service', date_text: 'Sunday 31 October, 09:00', body: 'Join us for the Reformation Day service, followed by tea in the hall. All leagues are welcome to attend in their uniforms.' },
  { congregation_id: cong.id, created_by: admin, title: 'Parish Clean-up Day', date_text: 'Saturday 14 November, 08:00', body: 'Bring gloves and a friend. Refreshments will be provided.' },
  { congregation_id: cong.id, created_by: nomsa, league_id: league('PrayerYouth'), title: 'Youth League Camp', date_text: 'Friday 20 – Sunday 22 November', body: 'Registration is open for the annual camp. Speak to your league chairperson to secure a place.' },
]), 'announcements')
must(await db.from('events').insert([
  { congregation_id: cong.id, created_by: admin, title: 'Choir practice', event_date: daysAhead(4), description: 'Weekly rehearsal in the church hall.', source: 'manual' },
  { congregation_id: cong.id, created_by: nomsa, league_id: league('PrayerYouth'), title: 'Youth League Camp', event_date: daysAhead(20), end_date: daysAhead(22), description: 'Annual camp.', source: 'manual' },
]), 'events')
must(await db.from('congregations').update({ snapscan_merchant_code: 'demoparish' }).eq('id', cong.id), 'snapscan code')

console.log(`Seeded ${filler.length + 10} accounts. Password for all of them: ${TEST_PASSWORD}`)
console.log('See docs/TEST_ACCOUNTS.md for who is who.')
void [admin2, pieter, zanele, ayanda]
