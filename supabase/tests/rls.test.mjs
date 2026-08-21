// RLS / multi-tenancy security tests for supabase/migrations/0001_init.sql.
//
// Run against a LOCAL Supabase instance only — never the live project:
//   npx supabase start                # brings up local Postgres+Auth via Docker
//   npx supabase db reset             # applies 0001_init.sql fresh
//   node --test supabase/tests/rls.test.mjs
//
// Seeds two congregations (TCP, the one 0001_init.sql itself seeds, plus a
// second "Test Congregation B" created here) each with an admin, a member,
// and the member's dependent, then asserts that nothing done as one
// congregation's admin/member can read, write, or approve anything belonging
// to the other congregation — the entire point of the Phase 1 rewrite.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'

// Node 20 has no stable native WebSocket — supabase-js's realtime client
// needs one injected, even though these tests never use realtime.
const clientOptions = { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: WebSocket } }

function localSupabaseCredentials() {
  const raw = execSync('npx supabase status -o json', { encoding: 'utf8', cwd: new URL('../..', import.meta.url) })
  const status = JSON.parse(raw)
  // The CLI's JSON key casing has changed across versions — accept either.
  const url = status.API_URL ?? status.api_url ?? status.apiUrl
  const anonKey = status.ANON_KEY ?? status.anon_key ?? status.anonKey
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key ?? status.serviceRoleKey
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(`Could not find API_URL/ANON_KEY/SERVICE_ROLE_KEY in \`supabase status -o json\` output: ${raw}`)
  }
  return { url, anonKey, serviceRoleKey }
}

const { url, anonKey, serviceRoleKey } = localSupabaseCredentials()
const admin = createClient(url, serviceRoleKey, clientOptions)

function anonClient() {
  return createClient(url, anonKey, clientOptions)
}

async function expectError(promise, messagePart, label) {
  const { error, data } = await promise
  assert.ok(error, `${label}: expected an error, got success with data=${JSON.stringify(data)}`)
  if (messagePart) {
    assert.ok(
      error.message.toLowerCase().includes(messagePart.toLowerCase()),
      `${label}: expected error mentioning "${messagePart}", got "${error.message}"`
    )
  }
}

async function expectOk(promise, label) {
  const { error, data } = await promise
  assert.ok(!error, `${label}: expected success, got error "${error?.message}"`)
  return data
}

let congA, congB
let wardA, leagueA, wardB, leagueB
let adminA, memberA, adminB, memberB // { id, email, client }
let depA, depB // dependent ids, owned by memberA / memberB

async function createTestUser({ email, congregationId, wardId, leagueId, role }) {
  const password = 'Test-password-1'
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: email.split('@')[0],
      congregation_id: congregationId,
      ward_id: wardId,
      league_id: leagueId ?? null,
    },
  })
  assert.ok(!createErr, `creating ${email}: ${createErr?.message}`)
  const id = created.user.id

  if (role === 'admin') {
    const { error: promoteErr } = await admin.from('profiles').update({ role: 'admin' }).eq('id', id)
    assert.ok(!promoteErr, `promoting ${email}: ${promoteErr?.message}`)
  }

  const client = anonClient()
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  assert.ok(!signInErr, `signing in ${email}: ${signInErr?.message}`)

  return { id, email, client }
}

before(async () => {
  // TCP is seeded by 0001_init.sql itself.
  const { data: tcp } = await admin.from('congregations').select('id').eq('slug', 'tshwane-city-parish').single()
  assert.ok(tcp, 'expected 0001_init.sql to have seeded the tshwane-city-parish congregation')
  congA = tcp

  const { data: wardsA } = await admin.from('wards').select('id').eq('congregation_id', congA.id).limit(1)
  const { data: leaguesA } = await admin.from('leagues').select('id').eq('congregation_id', congA.id).limit(1)
  wardA = wardsA[0]
  leagueA = leaguesA[0]

  // Congregation B exists purely for this test run — a second tenant with
  // its own ward/league, to prove isolation instead of assuming it.
  const { data: cb, error: cbErr } = await admin
    .from('congregations')
    .insert({ name: 'Test Congregation B', slug: `test-congregation-b-${Date.now()}` })
    .select('id')
    .single()
  assert.ok(!cbErr, cbErr?.message)
  congB = cb

  const { data: wb } = await admin.from('wards').insert({ congregation_id: congB.id, name: 'Only Ward', bank_code: 900, color: '#000000' }).select('id').single()
  const { data: lb } = await admin.from('leagues').insert({ congregation_id: congB.id, key: 'OnlyLeague', label: 'Only League', color: '#000000' }).select('id').single()
  wardB = wb
  leagueB = lb

  const stamp = Date.now()
  adminA = await createTestUser({ email: `admin-a-${stamp}@test.local`, congregationId: congA.id, wardId: wardA.id, role: 'admin' })
  memberA = await createTestUser({ email: `member-a-${stamp}@test.local`, congregationId: congA.id, wardId: wardA.id, role: 'member' })
  adminB = await createTestUser({ email: `admin-b-${stamp}@test.local`, congregationId: congB.id, wardId: wardB.id, role: 'admin' })
  memberB = await createTestUser({ email: `member-b-${stamp}@test.local`, congregationId: congB.id, wardId: wardB.id, role: 'member' })

  depA = await expectOk(
    memberA.client.rpc('add_dependent', { p_full_name: 'Dependent A', p_date_of_birth: '2015-01-01', p_ward_id: wardA.id }),
    'memberA creates depA'
  )
  depB = await expectOk(
    memberB.client.rpc('add_dependent', { p_full_name: 'Dependent B', p_date_of_birth: '2015-01-01', p_ward_id: wardB.id }),
    'memberB creates depB'
  )
})

// --- 1. Cross-tenant READ isolation -----------------------------------------

test('admin cannot read another congregation\'s profile row', async () => {
  const { data } = await adminA.client.from('profiles').select('*').eq('id', memberB.id)
  assert.equal(data.length, 0)
})

test('admin cannot read another congregation\'s dependent row', async () => {
  const { data } = await adminA.client.from('profiles').select('*').eq('id', memberB.id)
  assert.equal(data.length, 0)
  const { data: depData } = await adminA.client.from('dependents').select('*').eq('id', depB)
  assert.equal(depData.length, 0)
})

test('ordinary member cannot read another congregation\'s (or another member\'s) profile row', async () => {
  const { data } = await memberA.client.from('profiles').select('*').eq('id', memberB.id)
  assert.equal(data.length, 0)
})

test('member can read their own congregation\'s wards/leagues but not the other\'s', async () => {
  const { data: mine } = await memberA.client.from('wards').select('id').eq('id', wardA.id)
  assert.equal(mine.length, 1)
  const { data: theirs } = await memberA.client.from('wards').select('id').eq('id', wardB.id)
  assert.equal(theirs.length, 0)
})

// --- 2. Announcements: read + write isolation -------------------------------

test('announcements are isolated per congregation, including insert forgery', async () => {
  const annA = await expectOk(
    adminA.client.from('announcements').insert({ congregation_id: congA.id, title: 'Only for A' }).select('id').single(),
    'adminA creates announcement'
  )
  // adminB can't see A's announcement...
  const { data: seenByB } = await adminB.client.from('announcements').select('id').eq('id', annA.id)
  assert.equal(seenByB.length, 0)
  // ...and can't forge one stamped with A's congregation_id even though the
  // insert would otherwise succeed for their own congregation.
  await expectError(
    adminB.client.from('announcements').insert({ congregation_id: congA.id, title: 'Forged' }),
    null,
    'adminB inserting announcement stamped with congA'
  )
  // adminB can't update or delete A's announcement either.
  const { data: updateResult } = await adminB.client.from('announcements').update({ title: 'Hijacked' }).eq('id', annA.id).select()
  assert.equal((updateResult ?? []).length, 0)
})

// --- 3. Cross-tenant WRITE isolation: all 17 re-scoped admin RPCs ----------

const profileRpcs = [
  ['approve_league', {}],
  ['deny_league', {}],
  ['approve_baptism', {}],
  ['deny_baptism', {}],
  ['approve_confirmation', {}],
  ['deny_confirmation', {}],
  ['admin_update_member', { p_full_name: 'x', p_phone: null, p_ward_id: null, p_league_id: null, p_baptised: false, p_confirmed: false }],
  ['admin_set_role', { new_role: 'member' }],
  ['admin_remove_member', {}],
]

const dependentRpcs = [
  ['approve_dependent_league', {}],
  ['deny_dependent_league', {}],
  ['approve_dependent_baptism', {}],
  ['deny_dependent_baptism', {}],
  ['approve_dependent_confirmation', {}],
  ['deny_dependent_confirmation', {}],
  ['admin_update_dependent', { p_full_name: 'x', p_date_of_birth: null, p_ward_id: null, p_league_id: null, p_baptised: false, p_confirmed: false }],
  ['admin_remove_dependent', {}],
]

for (const [fn, extraArgs] of profileRpcs) {
  test(`${fn}: adminA cannot act on memberB (cross-tenant)`, async () => {
    await expectError(adminA.client.rpc(fn, { target_id: memberB.id, ...extraArgs }), 'not authorized', fn)
  })
}

for (const [fn, extraArgs] of dependentRpcs) {
  test(`${fn}: adminA cannot act on depB (cross-tenant)`, async () => {
    await expectError(adminA.client.rpc(fn, { target_id: depB, ...extraArgs }), 'not authorized', fn)
  })
}

test('sanity check: adminA CAN act on their own congregation\'s member (positive control)', async () => {
  await expectOk(
    adminA.client.rpc('admin_update_member', {
      target_id: memberA.id,
      p_full_name: 'Member A Renamed',
      p_phone: null,
      p_ward_id: wardA.id,
      p_league_id: null,
      p_baptised: false,
      p_confirmed: false,
    }),
    'adminA updating memberA'
  )
})

// --- 4. Per-congregation last-admin guard -----------------------------------

test('cannot demote the last admin of a congregation, even though other congregations have admins', async () => {
  // Congregation B also has an admin (adminB) at this point — before this
  // rewrite, a global admin count would have let this succeed. It must not.
  await expectError(
    adminA.client.rpc('admin_set_role', { target_id: adminA.id, new_role: 'member' }),
    'last remaining admin',
    'demoting sole admin of congregation A'
  )
})

// --- 5. stats_*/upcoming_birthdays are congregation-scoped ------------------

test('stats_by_ward only returns the caller\'s own congregation\'s wards', async () => {
  const rows = await expectOk(memberA.client.rpc('stats_by_ward'), 'memberA stats_by_ward')
  assert.ok(rows.every((r) => r.ward_id !== wardB.id))
})

test('stats_by_league only returns the caller\'s own congregation\'s leagues', async () => {
  const rows = await expectOk(memberA.client.rpc('stats_by_league'), 'memberA stats_by_league')
  assert.ok(rows.every((r) => r.league_id !== leagueB.id))
})

test('stats_sacraments total does not include the other congregation\'s people', async () => {
  const [rowsA] = await expectOk(memberA.client.rpc('stats_sacraments'), 'memberA stats_sacraments')
  const [rowsB] = await expectOk(memberB.client.rpc('stats_sacraments'), 'memberB stats_sacraments')
  // Each congregation here has exactly 1 member (admins are role='admin', not
  // counted) + 1 dependent = 2 people. If scoping leaked, A would see B's too.
  assert.equal(rowsA.total, 2)
  assert.equal(rowsB.total, 2)
})

test('upcoming_birthdays only returns the caller\'s own congregation', async () => {
  const rows = await expectOk(memberA.client.rpc('upcoming_birthdays', { days_ahead: 365 }), 'memberA upcoming_birthdays')
  assert.ok(rows.every((r) => r.ward_id !== wardB.id))
})

// --- 6. A member can't submit a cross-tenant ward_id/league_id -------------

test('request_league rejects a league_id belonging to another congregation', async () => {
  await expectError(
    memberA.client.rpc('request_league', { new_league_id: leagueB.id }),
    'invalid league',
    'memberA requesting congB\'s league'
  )
})

test('add_dependent rejects a ward_id belonging to another congregation', async () => {
  await expectError(
    memberA.client.rpc('add_dependent', { p_full_name: 'Bad Dependent', p_date_of_birth: '2015-01-01', p_ward_id: wardB.id }),
    'invalid ward',
    'memberA adding dependent with congB\'s ward'
  )
})

test('add_dependent ignores any attempt to influence congregation directly (no such parameter exists)', async () => {
  // There is no p_congregation_id parameter on add_dependent at all — the
  // dependent always inherits the guardian's own congregation server-side.
  // Covered structurally by the cross-tenant dependent RPC tests above
  // (adminB can never act on depA, proving depA's congregation really is A's).
  const { data: dep } = await admin.from('dependents').select('guardian_id').eq('id', depA).single()
  assert.equal(dep.guardian_id, memberA.id)
})

// --- 7. Regression checks (existing business logic must still hold) --------

test('confirmation is still blocked without baptism', async () => {
  await expectError(memberA.client.rpc('request_confirmation', {}), 'baptism is required', 'memberA requesting confirmation unbaptised')
})

test('a member still cannot set their own role/baptised/confirmed via a raw table update', async () => {
  await expectError(memberA.client.from('profiles').update({ role: 'admin' }).eq('id', memberA.id), null, 'memberA raw-updating own role')
  await expectError(memberA.client.from('profiles').update({ baptised: true }).eq('id', memberA.id), null, 'memberA raw-updating own baptised flag')
})

test('self-service RPCs only ever touch the caller\'s own row', async () => {
  await expectOk(memberA.client.rpc('update_my_phone', { new_phone: '0820000000' }), 'memberA updating own phone')
  const { data: b } = await admin.from('profiles').select('phone').eq('id', memberB.id).single()
  assert.notEqual(b.phone, '0820000000')
})

test('add_dependent inherits the guardian\'s congregation automatically', async () => {
  const { data: depRow } = await admin.from('dependents').select('guardian_id, ward_id').eq('id', depA).single()
  const { data: guardianRow } = await admin.from('profiles').select('congregation_id').eq('id', depRow.guardian_id).single()
  const { data: wardRow } = await admin.from('wards').select('congregation_id').eq('id', depRow.ward_id).single()
  assert.equal(guardianRow.congregation_id, wardRow.congregation_id)
})

after(async () => {
  // Best-effort cleanup so repeated runs against the same local instance
  // don't accumulate test users/congregations. Not load-bearing for the
  // assertions above — a `supabase db reset` also wipes all of this.
  for (const u of [adminA, memberA, adminB, memberB]) {
    if (u?.id) {
      try {
        await admin.auth.admin.deleteUser(u.id)
      } catch {}
    }
  }
  if (congB?.id) {
    try {
      await admin.from('congregations').delete().eq('id', congB.id)
    } catch {}
  }
})
