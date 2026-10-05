// Local-only smoke checks for the hard-coded admin trigger (0030) and RPCs the
// RLS suite doesn't call. Run against `npx supabase start` only.
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
const st = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }))
const url = st.API_URL, anon = st.ANON_KEY, svc = st.SERVICE_ROLE_KEY
const o = { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: WebSocket } }
const admin = createClient(url, svc, o)
const results = []
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} - ${name} ${extra}`) }

const { data: cong } = await admin.from('congregations').select('id').limit(1).single()
const { data: ward } = await admin.from('wards').select('id').eq('congregation_id', cong.id).limit(1).single()
const meta = { full_name: 'Hardcoded Admin', congregation_id: cong.id, ward_id: ward.id }

// 1. Hard-coded admin gets role=admin on signup, with no manual promotion.
const email = 'tshikovhitshedza9@gmail.com'
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: 'Passw0rd!x', email_confirm: true, user_metadata: meta })
check('hard-coded admin user created', !ue, ue?.message)
const { data: prof } = await admin.from('profiles').select('role').eq('id', u.user.id).single()
check('hard-coded email gets role=admin automatically', prof?.role === 'admin', `(role=${prof?.role})`)

// 2. Demoting it is reverted by the trigger.
await admin.from('profiles').update({ role: 'member' }).eq('id', u.user.id)
const { data: prof2 } = await admin.from('profiles').select('role').eq('id', u.user.id).single()
check('demoting the hard-coded admin is reverted', prof2?.role === 'admin', `(role=${prof2?.role})`)

// 3. A different email is NOT admin (case-insensitive match must not leak).
const { data: u2 } = await admin.auth.admin.createUser({ email: 'someone.else@example.com', password: 'Passw0rd!x', email_confirm: true, user_metadata: meta })
const { data: p3 } = await admin.from('profiles').select('role').eq('id', u2.user.id).single()
check('other email stays a member', p3?.role === 'member', `(role=${p3?.role})`)
const { data: u3 } = await admin.auth.admin.createUser({ email: 'TshikovhiTshedza9@Gmail.com'.replace('Tshedza9','Tshedza9x'), password: 'Passw0rd!x', email_confirm: true, user_metadata: meta })
const { data: p4 } = await admin.from('profiles').select('role').eq('id', u3.user.id).single()
check('look-alike email stays a member', p4?.role === 'member', `(role=${p4?.role})`)

// 4. Admin-only RPCs/tables work as that admin; a member is blocked.
const a = createClient(url, anon, o); await a.auth.signInWithPassword({ email, password: 'Passw0rd!x' })
const m = createClient(url, anon, o); await m.auth.signInWithPassword({ email: 'someone.else@example.com', password: 'Passw0rd!x' })
const codes = await a.rpc('admin_generate_household_codes', { p_count: 3 })
check('admin_generate_household_codes works for admin', !codes.error && codes.data?.length === 3, codes.error?.message ?? '')
const mcodes = await m.rpc('admin_generate_household_codes', { p_count: 3 })
check('admin_generate_household_codes blocked for member', !!mcodes.error)
const ann = await a.from('announcements').insert({ congregation_id: cong.id, title: 'Smoke', date_text: '', body: '' })
check('admin can post whole-church announcement', !ann.error, ann.error?.message ?? '')
const mann = await m.from('announcements').insert({ congregation_id: cong.id, title: 'Nope', date_text: '', body: '' })
check('member cannot post announcement', !!mann.error)
const { data: seen } = await a.from('announcements').select('id').eq('title', 'Smoke')
const del = await a.from('announcements').delete().eq('id', seen[0].id)
check('admin can delete announcement', !del.error)
const ev = await a.from('events').insert({ congregation_id: cong.id, title: 'Smoke ev', event_date: '2030-01-01' })
check('admin can post event', !ev.error, ev.error?.message ?? '')
const pay = await m.rpc('create_snapscan_payment', { p_amount_cents: 5000 })
check('member can start a SnapScan payment (regression for 0031)', !pay.error && pay.data?.length === 1, pay.error?.message ?? '')
const stats = await a.rpc('stats_sacraments')
check('stats_sacraments works', !stats.error, stats.error?.message ?? '')
for (const fn of ['stats_by_ward', 'stats_by_league', 'stats_by_gender', 'admin_list_auto_merge_flags']) {
  const r = await a.rpc(fn); check(`${fn} works for admin`, !r.error, r.error?.message ?? '')
}

// cleanup
for (const id of [u.user.id, u2.user.id, u3.user.id]) await admin.auth.admin.deleteUser(id)
console.log(`\n${results.filter(Boolean).length}/${results.length} passed`)
process.exit(results.every(Boolean) ? 0 : 1)
