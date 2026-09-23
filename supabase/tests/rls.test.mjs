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

import { test, before, after, describe } from 'node:test'
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

// This local Supabase setup appears to round-robin requests across more
// than one PostgREST worker, each with its own schema cache — so even after
// the first call to a function from a brand-new migration succeeds, a
// *later* call to the very same function can still land on a worker that
// hasn't reloaded yet and report it missing. That specific error string is
// always spurious infrastructure noise, never a real test outcome, so it's
// always safe to retry regardless of whether the call is expected to
// succeed or to fail for a domain reason (e.g. "not authorized") — a real
// domain error is returned immediately, unretried.
async function rpcRetryColdSchemaCache(fn, attempts = 10, delayMs = 250) {
  let result
  for (let i = 0; i < attempts; i++) {
    result = await fn()
    if (!result.error || !/schema cache/i.test(result.error.message)) return result
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return result
}

let congA, congB
let wardA, leagueA, wardB, leagueB
let adminA, memberA, adminB, memberB // { id, email, client }
let depA, depB // dependent ids, owned by memberA / memberB
let leagueA2, memberA2, memberA3 // second league in congA, plus two more congA members, for the league-admin section below

// A family code is mandatory at registration (0014_family_codes.sql), so
// every test user needs one. This mints a fresh, never-before-used code
// directly via the service-role client — the same "operator seeds a code"
// bootstrap an admin's admin_generate_household_codes() does at runtime,
// just without needing an admin (or even a congregation with one yet) to
// already exist. Each call gives the caller their own private singleton
// family unless a test deliberately reuses the same code for two users.
// TCP (congA) is never torn down between local runs the way congB is, so
// every id minted here is tracked and best-effort cleaned up in after() —
// otherwise these would silently pile up in TCP's household list forever.
let mintCounter = 0
const mintedHouseholdIds = []
async function mintHouseholdCode(congregationId) {
  mintCounter += 1
  const code = `T${Date.now().toString(36)}${mintCounter}`.toUpperCase()
  const { data, error } = await admin.from('households').insert({ congregation_id: congregationId, code }).select('id, code').single()
  assert.ok(!error, `minting a household code: ${error?.message}`)
  mintedHouseholdIds.push(data.id)
  return data
}

async function createTestUser({ email, congregationId, wardId, leagueId, role, householdCode }) {
  const password = 'Test-password-1'
  const code = householdCode ?? (await mintHouseholdCode(congregationId)).code
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: email.split('@')[0],
      congregation_id: congregationId,
      ward_id: wardId,
      league_id: leagueId ?? null,
      family_code: code,
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
  // profiles has no UPDATE policy at all (every mutation goes through a
  // security-definer RPC instead) — with row security enabled and no
  // applicable policy, Postgres doesn't raise an error here, it just treats
  // no row as eligible for update, so this returns success with 0 rows
  // affected rather than throwing. Assert on the actual invariant (the
  // value never changes) instead of an error that never comes.
  await expectOk(memberA.client.from('profiles').update({ role: 'admin' }).eq('id', memberA.id), 'memberA raw-updating own role')
  await expectOk(memberA.client.from('profiles').update({ baptised: true }).eq('id', memberA.id), 'memberA raw-updating own baptised flag')
  const { data: afterRaw } = await admin.from('profiles').select('role, baptised').eq('id', memberA.id).single()
  assert.equal(afterRaw.role, 'member')
  assert.equal(afterRaw.baptised, false)
})

test('self-service RPCs only ever touch the caller\'s own row', async () => {
  await expectOk(memberA.client.rpc('update_my_phone', { new_phone: '0820000000' }), 'memberA updating own phone')
  const { data: b } = await admin.from('profiles').select('phone').eq('id', memberB.id).single()
  assert.notEqual(b.phone, '0820000000')
})

test('confirm_still_member / self_report_left only ever touch the caller\'s own row', async () => {
  await expectOk(memberB.client.rpc('self_report_left'), 'memberB self-reporting as left')
  const { data: bAfterLeft } = await admin.from('profiles').select('self_reported_left_at, membership_confirmed_at').eq('id', memberB.id).single()
  assert.ok(bAfterLeft.self_reported_left_at)
  const { data: aUnaffected } = await admin.from('profiles').select('self_reported_left_at').eq('id', memberA.id).single()
  assert.equal(aUnaffected.self_reported_left_at, null)

  // Confirming "still here" afterwards clears the earlier self-report.
  await expectOk(memberB.client.rpc('confirm_still_member'), 'memberB confirming still a member')
  const { data: bAfterConfirm } = await admin.from('profiles').select('self_reported_left_at, membership_confirmed_at').eq('id', memberB.id).single()
  assert.equal(bAfterConfirm.self_reported_left_at, null)
  assert.ok(bAfterConfirm.membership_confirmed_at)
})

test('add_dependent inherits the guardian\'s congregation automatically', async () => {
  const { data: depRow } = await admin.from('dependents').select('guardian_id, ward_id').eq('id', depA).single()
  const { data: guardianRow } = await admin.from('profiles').select('congregation_id').eq('id', depRow.guardian_id).single()
  const { data: wardRow } = await admin.from('wards').select('congregation_id').eq('id', depRow.ward_id).single()
  assert.equal(guardianRow.congregation_id, wardRow.congregation_id)
})

// --- 7a. Households (registration bootstrap + admin find/manage tools) ------
//
// Every test user minted by createTestUser already has their own private
// singleton household from the moment they were created (a family code is
// mandatory at registration — see mintHouseholdCode/createTestUser above),
// so there's no "start from nothing" step here the way there used to be.

test('adminB (cross-tenant) cannot read, rename, delete, or assign into memberA\'s home household', async () => {
  const { data: mem } = await admin.from('profiles').select('household_id').eq('id', memberA.id).single()
  const homeAId = mem.household_id
  const { data: seenByB } = await adminB.client.from('households').select('id').eq('id', homeAId)
  assert.deepEqual(seenByB, [])
  await expectError(rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_rename_household', { target_id: homeAId, p_name: 'Hijacked' })), 'not authorized', 'adminB renaming memberA\'s household')
  await expectError(rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_delete_household', { target_id: homeAId })), 'not authorized', 'adminB deleting memberA\'s household')
  await expectError(rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_set_profile_household', { target_id: memberB.id, p_household_id: homeAId })), 'invalid family', 'adminB assigning memberB into memberA\'s household')
})

test('admin_set_profile_household rejects a household belonging to another congregation', async () => {
  const { data: mem } = await admin.from('profiles').select('household_id').eq('id', memberB.id).single()
  await expectError(
    rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_set_profile_household', { target_id: memberA.id, p_household_id: mem.household_id })),
    'invalid family',
    'adminA assigning memberA into congB\'s household'
  )
})

test('clearing a household assignment and deleting a household leaves members/dependents intact but unassigned', async () => {
  const { data: memBefore } = await admin.from('profiles').select('household_id').eq('id', memberA.id).single()
  await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_set_profile_household', { target_id: memberA.id, p_household_id: null })), 'adminA clearing memberA\'s household')
  await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_household', { target_id: memBefore.household_id })), 'adminA deleting memberA\'s original household')
  const { data: dep } = await admin.from('dependents').select('household_id').eq('id', depA).single()
  assert.equal(dep.household_id, null)
  const mine = await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('my_family')), 'memberA reading my_family once unassigned')
  assert.deepEqual(mine, [])
})

test('add_dependent inherits the guardian\'s household automatically', async () => {
  const { code } = await mintHouseholdCode(congA.id)
  const householdId = await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('join_family_by_code', { p_code: code })), 'memberA joining a minted code')
  const newDepId = await expectOk(
    rpcRetryColdSchemaCache(() => memberA.client.rpc('add_dependent', { p_full_name: 'Inherited Dependent', p_date_of_birth: '2018-01-01', p_ward_id: wardA.id })),
    'memberA adding a new dependent after joining a household'
  )
  const { data: newDep } = await admin.from('dependents').select('household_id').eq('id', newDepId).single()
  assert.equal(newDep.household_id, householdId)
  // Cleanup so later counts (e.g. stats_sacraments-style assertions) aren't affected.
  // join_family_by_code also cascaded onto depA (memberA's pre-existing dependent), so clear that too.
  await admin.from('dependents').delete().eq('id', newDepId)
  await admin.from('dependents').update({ household_id: null }).eq('id', depA)
  await admin.from('profiles').update({ household_id: null }).eq('id', memberA.id)
  await admin.from('households').delete().eq('id', householdId)
})

// --- 7b. Family codes: optional at registration (auto-matched if omitted), self-service joining, and admin-minted code pools ----

test('registering with a fresh code claims it and auto-names the family from the registrant\'s surname', async () => {
  const { id: householdId, code } = await mintHouseholdCode(congA.id)
  const { data: created, error } = await admin.auth.admin.createUser({
    email: `naming-test-${Date.now()}@test.local`,
    password: 'Test-password-1',
    email_confirm: true,
    user_metadata: { full_name: 'Naming Test Surname', congregation_id: congA.id, ward_id: wardA.id, family_code: code },
  })
  assert.ok(!error, `registering with a fresh code: ${error?.message}`)
  const { data: household } = await admin.from('households').select('name').eq('id', householdId).single()
  assert.equal(household.name, 'Surname Family')

  // Cleanup.
  await admin.auth.admin.deleteUser(created.user.id)
  await admin.from('households').delete().eq('id', householdId)
})

// GoTrue collapses any rejected-signup trigger failure into an opaque,
// message-less 500 — createUser()/signUp() never surface *why* it failed,
// only *that* it did. So the trigger-level tests below only assert
// rejection; check_family_code (a normal RPC, called by the registration
// screen before ever attempting signUp — see register.tsx) is what's
// actually responsible for a readable error message, and gets its own tests.

test('registration without a family code auto-starts a new family (0017 made family_code optional)', async () => {
  const uniqueSurname = `Nocode${Date.now().toString(36)}`
  const { data: created, error } = await admin.auth.admin.createUser({
    email: `no-code-test-${Date.now()}@test.local`,
    password: 'Test-password-1',
    email_confirm: true,
    user_metadata: { full_name: `Registrant ${uniqueSurname}`, congregation_id: congA.id, ward_id: wardA.id },
  })
  assert.ok(!error, `registering without a family code: ${error?.message}`)
  const { data: profile } = await admin.from('profiles').select('household_id').eq('id', created.user.id).single()
  assert.ok(profile.household_id, 'expected a household to be auto-minted since no surname+ward match existed')
  const { data: household } = await admin.from('households').select('name').eq('id', profile.household_id).single()
  assert.equal(household.name, `${uniqueSurname} Family`)

  // Cleanup.
  await admin.auth.admin.deleteUser(created.user.id)
  await admin.from('households').delete().eq('id', profile.household_id)
})

test('registration is rejected with an invalid family code', async () => {
  const { error } = await admin.auth.admin.createUser({
    email: `bad-code-test-${Date.now()}@test.local`,
    password: 'Test-password-1',
    email_confirm: true,
    user_metadata: { full_name: 'Bad Code Test', congregation_id: congA.id, ward_id: wardA.id, family_code: 'NOTREAL' },
  })
  assert.ok(error, 'expected registration with an invalid family code to fail')
})

test('registration rejects a code from another congregation', async () => {
  const { id: householdId, code } = await mintHouseholdCode(congB.id)
  const { error } = await admin.auth.admin.createUser({
    email: `cross-cong-code-test-${Date.now()}@test.local`,
    password: 'Test-password-1',
    email_confirm: true,
    user_metadata: { full_name: 'Cross Cong Test', congregation_id: congA.id, ward_id: wardA.id, family_code: code },
  })
  assert.ok(error, 'expected registering into congA with congB\'s code to fail')
  await admin.from('households').delete().eq('id', householdId)
})

test('check_family_code gives a clear error message the registration screen can show, unlike the createUser trigger path above', async () => {
  const { id: householdId, code } = await mintHouseholdCode(congA.id)
  await expectOk(rpcRetryColdSchemaCache(() => anonClient().rpc('check_family_code', { p_congregation_id: congA.id, p_code: code })), 'checking a valid code')
  await expectError(
    rpcRetryColdSchemaCache(() => anonClient().rpc('check_family_code', { p_congregation_id: congA.id, p_code: 'NOTREAL' })),
    'invalid family code',
    'checking a garbage code'
  )
  const { id: householdBId, code: codeB } = await mintHouseholdCode(congB.id)
  await expectError(
    rpcRetryColdSchemaCache(() => anonClient().rpc('check_family_code', { p_congregation_id: congA.id, p_code: codeB })),
    'invalid family code',
    'checking congB\'s code against congA'
  )
  await admin.from('households').delete().eq('id', householdId)
  await admin.from('households').delete().eq('id', householdBId)
})

// start_new_family (0016_self_service_family_code.sql) is what the "No, I'm
// first in my family" branch of the registration screen calls, pre-auth, to
// self-mint a code instead of requiring an admin-minted one.
test('start_new_family mints a fresh, working code for whoever is first in their family', async () => {
  const code = await expectOk(
    rpcRetryColdSchemaCache(() => anonClient().rpc('start_new_family', { p_congregation_id: congA.id })),
    'minting a self-service family code'
  )
  assert.equal(typeof code, 'string')
  assert.equal(code.length, 6)

  // The minted code has to actually work end to end: check_family_code
  // accepts it, and a real signup can claim it.
  await expectOk(rpcRetryColdSchemaCache(() => anonClient().rpc('check_family_code', { p_congregation_id: congA.id, p_code: code })), 'checking a self-minted code')
  const { error: signupErr, data: signupData } = await admin.auth.admin.createUser({
    email: `self-minted-code-test-${Date.now()}@test.local`,
    password: 'Test-password-1',
    email_confirm: true,
    user_metadata: { full_name: 'Self Minted Surname', congregation_id: congA.id, ward_id: wardA.id, family_code: code },
  })
  assert.ok(!signupErr, `registering with a self-minted code: ${signupErr?.message}`)

  const { data: household } = await admin.from('households').select('id, name').eq('code', code).single()
  assert.equal(household.name, 'Surname Family')
  mintedHouseholdIds.push(household.id)
})

test('start_new_family rejects an invalid congregation', async () => {
  await expectError(
    rpcRetryColdSchemaCache(() => anonClient().rpc('start_new_family', { p_congregation_id: '00000000-0000-0000-0000-000000000000' })),
    'invalid or missing congregation',
    'minting a code for a made-up congregation'
  )
})

test('a member can join a family by code, it cascades to existing dependents, and auto-names the family on first claim', async () => {
  const { id: householdId, code } = await mintHouseholdCode(congA.id)
  await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('join_family_by_code', { p_code: code })), 'memberA joining by code')
  const { data: mem } = await admin.from('profiles').select('household_id').eq('id', memberA.id).single()
  const { data: dep } = await admin.from('dependents').select('household_id').eq('id', depA).single()
  assert.equal(mem.household_id, householdId)
  assert.equal(dep.household_id, householdId, 'existing dependent should cascade onto the same family')

  const { data: household } = await admin.from('households').select('name').eq('id', householdId).single()
  assert.ok(household.name, 'household should be auto-named on first claim')

  const mine = await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('my_family')), 'memberA reading my_family')
  assert.equal(mine[0].id, householdId)
  assert.equal(mine[0].code, code)

  // Cleanup so later tests/counts elsewhere in the suite aren't affected.
  await admin.from('profiles').update({ household_id: null }).eq('id', memberA.id)
  await admin.from('dependents').update({ household_id: null }).eq('id', depA)
  await admin.from('households').delete().eq('id', householdId)
})

test('joining an already-named family does not overwrite its name', async () => {
  const { id: householdId, code } = await mintHouseholdCode(congA.id)
  await admin.from('households').update({ name: 'Established Family' }).eq('id', householdId)
  await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('join_family_by_code', { p_code: code })), 'memberA joining an already-named family')
  const { data: household } = await admin.from('households').select('name').eq('id', householdId).single()
  assert.equal(household.name, 'Established Family')

  await admin.from('profiles').update({ household_id: null }).eq('id', memberA.id)
  await admin.from('dependents').update({ household_id: null }).eq('id', depA)
  await admin.from('households').delete().eq('id', householdId)
})

test('a code from another congregation is rejected', async () => {
  const { id: householdId, code } = await mintHouseholdCode(congA.id)
  await expectError(
    rpcRetryColdSchemaCache(() => memberB.client.rpc('join_family_by_code', { p_code: code })),
    'invalid family code',
    'memberB joining congA\'s family code'
  )
  await admin.from('households').delete().eq('id', householdId)
})

test('a garbage code is rejected with a clear error', async () => {
  await expectError(rpcRetryColdSchemaCache(() => memberA.client.rpc('join_family_by_code', { p_code: 'NOTREAL' })), 'invalid family code', 'memberA joining a made-up code')
})

test('admin_regenerate_household_code is blocked cross-tenant, and issues a working new code', async () => {
  const { id: householdId, code } = await mintHouseholdCode(congA.id)
  await expectError(
    rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_regenerate_household_code', { target_id: householdId })),
    'not authorized',
    'adminB regenerating congA\'s household code'
  )
  const newCode = await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_regenerate_household_code', { target_id: householdId })), 'adminA regenerating own household code')
  assert.notEqual(newCode, code)
  await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('join_family_by_code', { p_code: newCode })), 'memberA joining with the freshly regenerated code')

  // Cleanup.
  await admin.from('profiles').update({ household_id: null }).eq('id', memberA.id)
  await admin.from('households').delete().eq('id', householdId)
})

test('admin_generate_household_codes creates unclaimed codes scoped to the admin\'s own congregation', async () => {
  const rows = await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_generate_household_codes', { p_count: 3 })), 'adminA generating 3 codes')
  assert.equal(rows.length, 3)
  const ids = rows.map((r) => r.id)
  const { data: created } = await admin.from('households').select('id, congregation_id, name').in('id', ids)
  assert.equal(created.length, 3)
  created.forEach((h) => {
    assert.equal(h.congregation_id, congA.id)
    assert.equal(h.name, null)
  })
  await admin.from('households').delete().in('id', ids)
})

test('a non-admin cannot generate household codes', async () => {
  await expectError(rpcRetryColdSchemaCache(() => memberA.client.rpc('admin_generate_household_codes', { p_count: 1 })), 'not authorized', 'memberA generating codes')
})

test('admin_generate_household_codes rejects an out-of-range count', async () => {
  await expectError(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_generate_household_codes', { p_count: 0 })), 'between 1 and 100', 'adminA generating 0 codes')
  await expectError(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_generate_household_codes', { p_count: 101 })), 'between 1 and 100', 'adminA generating 101 codes')
})

// --- 8 & 9. League admins and league points --------------------------------
//
// Scoped in its own describe() with its own before() so its extra congA
// members (memberA2, memberA3) are created only once every test above has
// already run — the stats_sacraments test above counts exactly 1 member + 1
// dependent per congregation, and root-level before()/test() ordering
// relative to a second root-level before() isn't guaranteed by this test
// runner, so nesting is what makes the ordering deterministic here.
describe('league admins', () => {
  before(async () => {
    // leagueA2 is a *second* league inside congregation A — proves a league
    // admin is scoped to their own league even among leagues in the SAME
    // congregation, not just across congregations (already covered above).
    const { data: la2, error: la2Err } = await admin
      .from('leagues')
      .insert({ congregation_id: congA.id, key: 'SecondLeagueA', label: 'Second League A', color: '#111111' })
      .select('id')
      .single()
    assert.ok(!la2Err, la2Err?.message)
    leagueA2 = la2

    const stamp = Date.now()
    memberA2 = await createTestUser({ email: `member-a2-${stamp}@test.local`, congregationId: congA.id, wardId: wardA.id, role: 'member' })
    memberA3 = await createTestUser({ email: `member-a3-${stamp}@test.local`, congregationId: congA.id, wardId: wardA.id, role: 'member' })

    await expectOk(
      adminA.client.rpc('admin_set_league_admin', { target_profile_id: memberA2.id, target_league_id: leagueA.id, make_admin: true }),
      'adminA making memberA2 a league admin of leagueA'
    )
  })

  test('a plain member cannot assign themselves (or anyone) as a league admin', async () => {
    await expectError(
      memberA.client.rpc('admin_set_league_admin', { target_profile_id: memberA.id, target_league_id: leagueA.id, make_admin: true }),
      'not authorized',
      'memberA self-assigning league admin'
    )
  })

  test('league admin can post an announcement for their own league', async () => {
    await expectOk(
      memberA2.client.from('announcements').insert({ congregation_id: congA.id, league_id: leagueA.id, title: 'League A news' }),
      'memberA2 (league admin of leagueA) posting to leagueA'
    )
  })

  test('league admin cannot post an announcement for a different league in the same congregation', async () => {
    await expectError(
      memberA2.client.from('announcements').insert({ congregation_id: congA.id, league_id: leagueA2.id, title: 'Should be blocked' }),
      null,
      'memberA2 posting to leagueA2 (not theirs)'
    )
  })

  test('league admin cannot post an event for a different league', async () => {
    await expectError(
      memberA2.client.from('events').insert({ congregation_id: congA.id, league_id: leagueA2.id, title: 'Should be blocked', event_date: '2027-01-01' }),
      null,
      'memberA2 posting an event to leagueA2 (not theirs)'
    )
  })

  test('league admin CAN post a whole-church announcement (league_id null), stamped as its creator', async () => {
    const ann = await expectOk(
      memberA2.client.from('announcements').insert({ congregation_id: congA.id, league_id: null, title: 'Whole church, from a league admin' }).select('id, created_by').single(),
      'memberA2 posting a whole-church announcement'
    )
    assert.equal(ann.created_by, memberA2.id)
    // Everyone in the congregation can read it (regular announcements: read policy, unchanged).
    const { data: seenByMemberA } = await memberA.client.from('announcements').select('id').eq('id', ann.id)
    assert.equal(seenByMemberA.length, 1)
    // The league admin who created it can also edit/delete their own whole-church post.
    await expectOk(memberA2.client.from('announcements').update({ title: 'Edited by its creator' }).eq('id', ann.id), 'memberA2 editing their own whole-church post')
  })

  test('a plain member (not a league admin) cannot post a whole-church announcement', async () => {
    await expectError(
      memberA.client.from('announcements').insert({ congregation_id: congA.id, league_id: null, title: 'Should be blocked' }),
      null,
      'memberA (plain member) posting whole-church'
    )
  })

  test("a league admin cannot edit another league admin's whole-church post", async () => {
    const ann = await expectOk(
      adminA.client.from('announcements').insert({ congregation_id: congA.id, league_id: null, title: 'Posted by congregation admin' }).select('id').single(),
      'adminA posting a whole-church announcement'
    )
    const { data } = await memberA2.client.from('announcements').update({ title: 'Hijacked' }).eq('id', ann.id).select()
    assert.equal((data ?? []).length, 0)
  })

  test('league admin can approve a join request for their own league', async () => {
    await expectOk(memberA3.client.rpc('request_league', { new_league_id: leagueA.id }), 'memberA3 requesting leagueA')
    await expectOk(memberA2.client.rpc('approve_league', { target_id: memberA3.id }), 'memberA2 (league admin) approving memberA3 into leagueA')
    const { data: row } = await admin.from('profiles').select('league_id').eq('id', memberA3.id).single()
    assert.equal(row.league_id, leagueA.id)
  })

  test('league admin cannot approve a join request for a different league', async () => {
    await expectOk(memberA.client.rpc('request_league', { new_league_id: leagueA2.id }), 'memberA requesting leagueA2')
    await expectError(memberA2.client.rpc('approve_league', { target_id: memberA.id }), 'not authorized', 'memberA2 approving into leagueA2 (not theirs)')
    await expectOk(memberA.client.rpc('cancel_league_request'), 'memberA cancelling stray leagueA2 request') // cleanup for later tests
  })

  test("league admin's visibility into pending profiles is scoped to their own league's pending requests", async () => {
    await expectOk(memberA.client.rpc('request_league', { new_league_id: leagueA2.id }), 'memberA requesting leagueA2 again')
    // memberA2 administers leagueA, not leagueA2 — memberA's pending request
    // (for leagueA2) must stay invisible to them even though both are in congA.
    const { data } = await memberA2.client.from('profiles').select('id').eq('id', memberA.id)
    assert.equal(data.length, 0)
    await expectOk(memberA.client.rpc('cancel_league_request'), 'memberA cancelling stray leagueA2 request (2)')
  })

})

// --- 10. Ceremony scheduling: propose a date, member confirms, calendar entry appears ---

describe('ceremony scheduling', () => {
  let baptismProposalId

  before(async () => {
    await expectOk(memberA.client.rpc('request_baptism', {}), 'memberA requesting baptism')
  })

  test('a plain member cannot propose their own ceremony date', async () => {
    await expectError(
      memberA.client.rpc('propose_ceremony_date', { target_id: memberA.id, p_is_dependent: false, p_kind: 'baptism', p_ceremony_date: '2027-01-10' }),
      'not authorized',
      'memberA proposing own date'
    )
  })

  test('adminA can propose a baptism date for memberA', async () => {
    baptismProposalId = await expectOk(
      adminA.client.rpc('propose_ceremony_date', { target_id: memberA.id, p_is_dependent: false, p_kind: 'baptism', p_ceremony_date: '2027-01-10' }),
      'adminA proposing baptism date'
    )
    assert.ok(baptismProposalId)
  })

  test('cannot propose a second date while one is already awaiting a response', async () => {
    await expectError(
      adminA.client.rpc('propose_ceremony_date', { target_id: memberA.id, p_is_dependent: false, p_kind: 'baptism', p_ceremony_date: '2027-02-01' }),
      'already been proposed',
      'adminA proposing a second date'
    )
  })

  test('someone else cannot confirm a proposal that is not theirs', async () => {
    await expectError(memberB.client.rpc('confirm_ceremony_date', { proposal_id: baptismProposalId }), 'not authorized', "memberB confirming memberA's proposal")
  })

  test('memberA can see their own proposal', async () => {
    const { data } = await memberA.client.from('ceremony_proposals').select('id').eq('id', baptismProposalId)
    assert.equal(data.length, 1)
  })

  test('confirming finalizes the baptism and creates a calendar event', async () => {
    await expectOk(memberA.client.rpc('confirm_ceremony_date', { proposal_id: baptismProposalId }), 'memberA confirming baptism date')
    const { data: prof } = await admin.from('profiles').select('baptised, pending_baptism').eq('id', memberA.id).single()
    assert.equal(prof.baptised, true)
    assert.equal(prof.pending_baptism, false)
    const { data: ev } = await admin.from('events').select('id').eq('congregation_id', congA.id).eq('title', 'Baptism').eq('event_date', '2027-01-10')
    assert.equal(ev.length, 1)
  })

  test('confirming an already-answered proposal fails', async () => {
    await expectError(memberA.client.rpc('confirm_ceremony_date', { proposal_id: baptismProposalId }), 'already been responded', 'memberA confirming again')
  })

  test('a second person sharing the same baptism date shares one calendar event, not a duplicate', async () => {
    await expectOk(memberA3.client.rpc('request_baptism', {}), 'memberA3 requesting baptism')
    const propId = await expectOk(
      adminA.client.rpc('propose_ceremony_date', { target_id: memberA3.id, p_is_dependent: false, p_kind: 'baptism', p_ceremony_date: '2027-01-10' }),
      'adminA proposing the same baptism date for memberA3'
    )
    await expectOk(memberA3.client.rpc('confirm_ceremony_date', { proposal_id: propId }), 'memberA3 confirming')
    const { data: ev } = await admin.from('events').select('id').eq('congregation_id', congA.id).eq('title', 'Baptism').eq('event_date', '2027-01-10')
    assert.equal(ev.length, 1)
  })

  test('declining leaves the request pending, and a new date can be proposed afterwards', async () => {
    await expectOk(memberB.client.rpc('request_baptism', {}), 'memberB requesting baptism')
    const propId = await expectOk(
      adminB.client.rpc('propose_ceremony_date', { target_id: memberB.id, p_is_dependent: false, p_kind: 'baptism', p_ceremony_date: '2027-03-01' }),
      'adminB proposing baptism date for memberB'
    )
    await expectOk(memberB.client.rpc('decline_ceremony_date', { proposal_id: propId }), 'memberB declining')
    const { data: prof } = await admin.from('profiles').select('baptised, pending_baptism').eq('id', memberB.id).single()
    assert.equal(prof.baptised, false)
    assert.equal(prof.pending_baptism, true)
    const { data: ev } = await admin.from('events').select('id').eq('congregation_id', congB.id).eq('title', 'Baptism')
    assert.equal(ev.length, 0)
    const propId2 = await expectOk(
      adminB.client.rpc('propose_ceremony_date', { target_id: memberB.id, p_is_dependent: false, p_kind: 'baptism', p_ceremony_date: '2027-03-15' }),
      'adminB proposing a new baptism date after decline'
    )
    assert.ok(propId2)
  })

  test('a league admin can propose an installation date for their own league, and confirming finalizes it', async () => {
    await expectOk(memberA.client.rpc('request_league', { new_league_id: leagueA.id }), 'memberA requesting leagueA')
    const propId = await expectOk(
      memberA2.client.rpc('propose_ceremony_date', { target_id: memberA.id, p_is_dependent: false, p_kind: 'league', p_ceremony_date: '2027-04-01', p_league_id: leagueA.id }),
      'memberA2 (league admin) proposing installation date'
    )
    await expectOk(memberA.client.rpc('confirm_ceremony_date', { proposal_id: propId }), 'memberA confirming installation')
    const { data: prof } = await admin.from('profiles').select('league_id, pending_league_id').eq('id', memberA.id).single()
    assert.equal(prof.league_id, leagueA.id)
    assert.equal(prof.pending_league_id, null)
    const { data: ev } = await admin.from('events').select('id, title').eq('congregation_id', congA.id).eq('event_date', '2027-04-01')
    assert.equal(ev.length, 1)
    assert.ok(ev[0].title.includes('Installation'))
  })

  test('a league admin cannot propose an installation date for a different league', async () => {
    await expectOk(memberA3.client.rpc('request_league', { new_league_id: leagueA2.id }), 'memberA3 requesting leagueA2')
    await expectError(
      memberA2.client.rpc('propose_ceremony_date', { target_id: memberA3.id, p_is_dependent: false, p_kind: 'league', p_ceremony_date: '2027-05-01', p_league_id: leagueA2.id }),
      'not authorized',
      'memberA2 (admin of leagueA only) proposing for leagueA2'
    )
  })
})

// --- 11. Age-group categorization is by actual date of birth, not by which table a row is in ---

describe('age-group categorization', () => {
  test('a self-registered member who is a child and a dependent who is an adult are both classified correctly', async () => {
    // memberB is a `profiles` row (a self-registered account) and depB is a
    // `dependents` row (guardian-managed) — deliberately picking ages that
    // contradict what table-based guessing would assume for each. (Admins
    // are excluded from these two RPCs entirely, by design, same as before
    // this change — they're not part of the congregation "people" stats.)
    await admin.from('profiles').update({ date_of_birth: '2015-06-01' }).eq('id', memberB.id) // a "member" who's actually a child
    await admin.from('dependents').update({ date_of_birth: '1985-01-01' }).eq('id', depB) // a "dependent" who's actually an adult

    const [stats] = await expectOk(memberB.client.rpc('stats_sacraments'), 'memberB stats_sacraments')
    assert.equal(stats.total, 2) // memberB + depB
    assert.equal(stats.children, 1) // memberB only, despite being a profiles row
    assert.equal(stats.adults, 1) // depB only, despite being a dependents row
    assert.equal(stats.elders, 0)

    const bdays = await expectOk(memberB.client.rpc('upcoming_birthdays', { days_ahead: 400 }), 'memberB upcoming_birthdays')
    const ageGroupByDob = Object.fromEntries(bdays.map((r) => [r.date_of_birth, r.age_group]))
    assert.equal(ageGroupByDob['2015-06-01'], 'child')
    assert.equal(ageGroupByDob['1985-01-01'], 'adult')
  })

  test('age_group() reclassifies purely from the birthdate, with no memory of past results', async () => {
    const child = await expectOk(memberB.client.rpc('age_group', { dob: '2015-06-01' }), 'age_group child')
    const elder = await expectOk(memberB.client.rpc('age_group', { dob: '1950-01-01' }), 'age_group elder')
    const unknown = await expectOk(memberB.client.rpc('age_group', { dob: null }), 'age_group unknown')
    assert.equal(child, 'child')
    assert.equal(elder, 'elder')
    assert.equal(unknown, null)
  })
})

// --- 12. Professions & the congregation directory ---------------------------

test('update_my_profession only ever touches the caller\'s own row, and is visible in congregation_directory', async () => {
  await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('update_my_profession', { new_profession: 'Electrician' })), 'memberA setting their profession')
  const { data: a } = await admin.from('profiles').select('profession').eq('id', memberA.id).single()
  assert.equal(a.profession, 'Electrician')
  const { data: b } = await admin.from('profiles').select('profession').eq('id', memberB.id).single()
  assert.notEqual(b.profession, 'Electrician')

  const directory = await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('congregation_directory')), 'memberA reading the directory')
  const entry = directory.find((d) => d.id === memberA.id)
  assert.ok(entry, 'memberA should appear in their own congregation\'s directory')
  assert.equal(entry.profession, 'Electrician')

  // Cleanup so later counts/other tests aren't affected.
  await admin.from('profiles').update({ profession: null }).eq('id', memberA.id)
})

test('congregation_directory omits members who have not set a profession, and never crosses tenants', async () => {
  const directoryA = await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('congregation_directory')), 'memberA reading the directory with no profession set')
  assert.deepEqual(directoryA, [])

  await expectOk(rpcRetryColdSchemaCache(() => memberB.client.rpc('update_my_profession', { new_profession: 'Nurse' })), 'memberB setting their profession')
  const directoryAAfter = await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('congregation_directory')), 'memberA reading the directory after memberB (a different congregation) sets theirs')
  assert.ok(!directoryAAfter.some((d) => d.id === memberB.id), 'memberB is in congB, must not appear in congA\'s directory')

  const directoryB = await expectOk(rpcRetryColdSchemaCache(() => memberB.client.rpc('congregation_directory')), 'memberB reading their own directory')
  assert.ok(directoryB.some((d) => d.id === memberB.id && d.profession === 'Nurse'))

  // Cleanup.
  await admin.from('profiles').update({ profession: null }).eq('id', memberB.id)
})

test('a blank profession clears it back out of the directory', async () => {
  await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('update_my_profession', { new_profession: 'Teacher' })), 'memberA setting their profession')
  await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('update_my_profession', { new_profession: '  ' })), 'memberA clearing their profession with blank input')
  const { data: a } = await admin.from('profiles').select('profession').eq('id', memberA.id).single()
  assert.equal(a.profession, null)
})

// --- 11. Phase 2: congregation admin — wards, leagues, branding, banking ---
// (supabase/migrations/0023_congregation_branding_banking.sql +
// 0024_congregation_admin_rpcs.sql). Runs last, after congA's wards/leagues
// already have real members/league admins attached (from earlier sections),
// so the "blocked while referenced" delete tests have real data to bite on
// without this section needing to set any of that up itself.

test('list_congregations returns every congregation, even anonymously, with only the safe columns', async () => {
  const rows = await expectOk(rpcRetryColdSchemaCache(() => anonClient().rpc('list_congregations')), 'anonymous list_congregations')
  const a = rows.find((r) => r.id === congA.id)
  const b = rows.find((r) => r.id === congB.id)
  assert.ok(a, 'expected congA in the anonymous directory')
  assert.ok(b, 'expected congB in the anonymous directory')
  assert.deepEqual(new Set(Object.keys(a)), new Set(['id', 'name', 'slug', 'tagline', 'address', 'logo_url', 'primary_color']))
})

test('member can read their own congregation row but not the other\'s', async () => {
  const { data: mine } = await memberA.client.from('congregations').select('id').eq('id', congA.id)
  assert.equal(mine.length, 1)
  const { data: theirs } = await memberA.client.from('congregations').select('id').eq('id', congB.id)
  assert.equal(theirs.length, 0)
})

test('congregation_bank_accounts/congregation_payment_codes are isolated per congregation', async () => {
  const { data: acctB, error: acctErr } = await admin
    .from('congregation_bank_accounts')
    .insert({ congregation_id: congB.id, name: 'Only Account', bank_name: 'Test Bank', account_number: '123', branch_code: '456' })
    .select('id')
    .single()
  assert.ok(!acctErr, acctErr?.message)
  const { data: seenByA } = await memberA.client.from('congregation_bank_accounts').select('id').eq('id', acctB.id)
  assert.equal(seenByA.length, 0)
  const { data: seenByB } = await memberB.client.from('congregation_bank_accounts').select('id').eq('id', acctB.id)
  assert.equal(seenByB.length, 1)

  const { data: codeB, error: codeErr } = await admin
    .from('congregation_payment_codes')
    .insert({ congregation_id: congB.id, account_id: acctB.id, code: 'ONLY', label: 'Only Code' })
    .select('id')
    .single()
  assert.ok(!codeErr, codeErr?.message)
  const { data: codeSeenByA } = await memberA.client.from('congregation_payment_codes').select('id').eq('id', codeB.id)
  assert.equal(codeSeenByA.length, 0)
})

describe('congregation admin: wards, leagues, branding, banking', () => {
  let testWardId, testLeagueId, testAccountId, testCodeId

  test('a plain member cannot create a ward', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => memberA.client.rpc('admin_create_ward', { p_name: 'Should Fail', p_bank_code: 999, p_color: '#000000' })),
      'not authorized',
      'memberA creating a ward'
    )
  })

  test('adminA can create a ward for their own congregation (positive control)', async () => {
    testWardId = await expectOk(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_create_ward', { p_name: 'Test Ward', p_bank_code: 999, p_color: '#123456' })),
      'adminA creating a ward'
    )
    const { data: row } = await admin.from('wards').select('congregation_id').eq('id', testWardId).single()
    assert.equal(row.congregation_id, congA.id)
  })

  test('adminB cannot update or delete adminA\'s newly created ward (cross-tenant)', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_update_ward', { target_id: testWardId, p_name: 'Hijacked', p_bank_code: 1, p_color: '#000000' })),
      'not authorized',
      'adminB updating congA\'s ward'
    )
    await expectError(rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_delete_ward', { target_id: testWardId })), 'not authorized', 'adminB deleting congA\'s ward')
  })

  test('adminA can update their own new ward', async () => {
    await expectOk(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_update_ward', { target_id: testWardId, p_name: 'Renamed Ward', p_bank_code: 998, p_color: '#654321' })),
      'adminA updating own ward'
    )
    const { data: row } = await admin.from('wards').select('name').eq('id', testWardId).single()
    assert.equal(row.name, 'Renamed Ward')
  })

  test('admin_delete_ward is blocked while members are still assigned to it, but succeeds once empty', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_ward', { target_id: wardA.id })),
      'still has members',
      'adminA deleting wardA while members are assigned'
    )
    await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_ward', { target_id: testWardId })), 'adminA deleting their empty test ward')
    const { data: gone } = await admin.from('wards').select('id').eq('id', testWardId)
    assert.equal(gone.length, 0)
  })

  test('a plain member cannot create a league', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => memberA.client.rpc('admin_create_league', { p_key: 'SHOULDFAIL', p_label: 'Should Fail', p_info: null, p_color: '#000000', p_has_badge: false })),
      'not authorized',
      'memberA creating a league'
    )
  })

  test('adminA can create a league for their own congregation (positive control)', async () => {
    testLeagueId = await expectOk(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_create_league', { p_key: 'TESTLEAGUE', p_label: 'Test League', p_info: null, p_color: '#123456', p_has_badge: false })),
      'adminA creating a league'
    )
    const { data: row } = await admin.from('leagues').select('congregation_id').eq('id', testLeagueId).single()
    assert.equal(row.congregation_id, congA.id)
  })

  test('adminB cannot update or delete adminA\'s newly created league (cross-tenant)', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_update_league', { target_id: testLeagueId, p_label: 'Hijacked', p_info: null, p_color: '#000000', p_has_badge: false })),
      'not authorized',
      'adminB updating congA\'s league'
    )
    await expectError(rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_delete_league', { target_id: testLeagueId })), 'not authorized', 'adminB deleting congA\'s league')
  })

  test('adminA can update their own new league', async () => {
    await expectOk(
      rpcRetryColdSchemaCache(() =>
        adminA.client.rpc('admin_update_league', { target_id: testLeagueId, p_label: 'Renamed League', p_info: 'Updated', p_color: '#654321', p_has_badge: true })
      ),
      'adminA updating own league'
    )
    const { data: row } = await admin.from('leagues').select('label').eq('id', testLeagueId).single()
    assert.equal(row.label, 'Renamed League')
  })

  test('admin_delete_league is blocked while members/league admins are still attached, but succeeds once empty', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_league', { target_id: leagueA.id })),
      'still has',
      'adminA deleting leagueA while members/league admins are attached'
    )
    await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_league', { target_id: testLeagueId })), 'adminA deleting their empty test league')
  })

  test('a plain member cannot update congregation branding', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() =>
        memberA.client.rpc('admin_update_congregation_branding', { p_name: 'Should Fail', p_tagline: null, p_address: null, p_logo_url: null, p_primary_color: '#000000', p_accent_color: null })
      ),
      'not authorized',
      'memberA updating branding'
    )
  })

  test('adminA can update their own congregation\'s branding, and it never leaks into congB', async () => {
    await expectOk(
      rpcRetryColdSchemaCache(() =>
        adminA.client.rpc('admin_update_congregation_branding', {
          p_name: 'ELCSA Tshwane City Parish',
          p_tagline: 'Updated Tagline',
          p_address: null,
          p_logo_url: null,
          p_primary_color: '#111111',
          p_accent_color: '#222222',
        })
      ),
      'adminA updating own branding'
    )
    const { data: rowA } = await admin.from('congregations').select('tagline').eq('id', congA.id).single()
    assert.equal(rowA.tagline, 'Updated Tagline')
    const { data: rowB } = await admin.from('congregations').select('tagline').eq('id', congB.id).single()
    assert.notEqual(rowB.tagline, 'Updated Tagline')
  })

  test('admin_set_snapscan_qr is scoped to the caller\'s own congregation', async () => {
    await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_set_snapscan_qr', { p_snapscan_qr_url: 'data:image/jpeg;base64,AAAA' })), 'adminA setting snapscan qr')
    const { data: rowA } = await admin.from('congregations').select('snapscan_qr_url').eq('id', congA.id).single()
    assert.equal(rowA.snapscan_qr_url, 'data:image/jpeg;base64,AAAA')
    const { data: rowB } = await admin.from('congregations').select('snapscan_qr_url').eq('id', congB.id).single()
    assert.equal(rowB.snapscan_qr_url, null)
  })

  test('a plain member cannot create a bank account', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => memberA.client.rpc('admin_create_bank_account', { p_name: 'Should Fail', p_bank_name: 'X', p_account_number: '1', p_branch_code: '1' })),
      'not authorized',
      'memberA creating a bank account'
    )
  })

  test('adminA can create a bank account for their own congregation (positive control)', async () => {
    testAccountId = await expectOk(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_create_bank_account', { p_name: 'Test Account', p_bank_name: 'Test Bank', p_account_number: '111', p_branch_code: '222' })),
      'adminA creating a bank account'
    )
    const { data: row } = await admin.from('congregation_bank_accounts').select('congregation_id').eq('id', testAccountId).single()
    assert.equal(row.congregation_id, congA.id)
  })

  test('adminB cannot update or delete adminA\'s new bank account (cross-tenant)', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_update_bank_account', { target_id: testAccountId, p_name: 'Hijacked', p_bank_name: 'X', p_account_number: '1', p_branch_code: '1' })),
      'not authorized',
      'adminB updating congA\'s bank account'
    )
    await expectError(rpcRetryColdSchemaCache(() => adminB.client.rpc('admin_delete_bank_account', { target_id: testAccountId })), 'not authorized', 'adminB deleting congA\'s bank account')
  })

  test('adminA can create a payment code pointing at their own new account', async () => {
    testCodeId = await expectOk(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_create_payment_code', { p_code: 'TESTCODE', p_label: 'Test Code', p_account_id: testAccountId })),
      'adminA creating a payment code'
    )
    const { data: row } = await admin.from('congregation_payment_codes').select('congregation_id').eq('id', testCodeId).single()
    assert.equal(row.congregation_id, congA.id)
  })

  test('admin_create_payment_code rejects an account_id belonging to another congregation', async () => {
    const { data: acctB } = await admin.from('congregation_bank_accounts').select('id').eq('congregation_id', congB.id).limit(1).single()
    await expectError(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_create_payment_code', { p_code: 'CROSSCODE', p_label: 'Cross Code', p_account_id: acctB.id })),
      'invalid account',
      'adminA creating a payment code pointing at congB\'s account'
    )
  })

  test('admin_delete_bank_account is blocked while a payment code still points at it, but succeeds once empty', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_bank_account', { target_id: testAccountId })),
      'reference codes',
      'adminA deleting an account still referenced by a payment code'
    )
    await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_payment_code', { target_id: testCodeId })), 'adminA deleting the test payment code')
    await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_delete_bank_account', { target_id: testAccountId })), 'adminA deleting the now-empty test account')
  })

  test('admin_set_snapscan_merchant_code is scoped to the caller\'s own congregation', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => memberA.client.rpc('admin_set_snapscan_merchant_code', { p_code: 'should-fail' })),
      'not authorized',
      'memberA setting the snapscan merchant code'
    )
    await expectOk(rpcRetryColdSchemaCache(() => adminA.client.rpc('admin_set_snapscan_merchant_code', { p_code: 'tcp-test-code' })), 'adminA setting the snapscan merchant code')
    const { data: rowA } = await admin.from('congregations').select('snapscan_merchant_code').eq('id', congA.id).single()
    assert.equal(rowA.snapscan_merchant_code, 'tcp-test-code')
    const { data: rowB } = await admin.from('congregations').select('snapscan_merchant_code').eq('id', congB.id).single()
    assert.equal(rowB.snapscan_merchant_code, null)
  })
})

describe('SnapScan paygate', () => {
  let paymentId, paymentReference, paymentCodeA, paymentCodeB

  before(async () => {
    const { data: acctA } = await admin
      .from('congregation_bank_accounts')
      .insert({ congregation_id: congA.id, name: 'SnapScan Test Account', bank_name: 'Test Bank', account_number: '111', branch_code: '222' })
      .select('id')
      .single()
    const { data: codeA } = await admin
      .from('congregation_payment_codes')
      .insert({ congregation_id: congA.id, account_id: acctA.id, code: 'SNPTEST', label: 'SnapScan Test Purpose' })
      .select('id')
      .single()
    paymentCodeA = codeA.id

    const { data: acctB } = await admin
      .from('congregation_bank_accounts')
      .insert({ congregation_id: congB.id, name: 'SnapScan Test Account B', bank_name: 'Test Bank', account_number: '333', branch_code: '444' })
      .select('id')
      .single()
    const { data: codeB } = await admin
      .from('congregation_payment_codes')
      .insert({ congregation_id: congB.id, account_id: acctB.id, code: 'SNPTESTB', label: 'SnapScan Test Purpose B' })
      .select('id')
      .single()
    paymentCodeB = codeB.id
  })

  test('create_snapscan_payment rejects an invalid amount', async () => {
    await expectError(rpcRetryColdSchemaCache(() => memberA.client.rpc('create_snapscan_payment', { p_amount_cents: 0 })), 'Invalid amount', 'memberA requesting a zero-amount payment')
    await expectError(rpcRetryColdSchemaCache(() => memberA.client.rpc('create_snapscan_payment', { p_amount_cents: -500 })), 'Invalid amount', 'memberA requesting a negative-amount payment')
    await expectError(
      rpcRetryColdSchemaCache(() => memberA.client.rpc('create_snapscan_payment', { p_amount_cents: 20000000 })),
      'Invalid amount',
      'memberA requesting an over-the-cap payment'
    )
  })

  test('create_snapscan_payment creates a pending row owned by the caller, in their own congregation', async () => {
    const [row] = await expectOk(rpcRetryColdSchemaCache(() => memberA.client.rpc('create_snapscan_payment', { p_amount_cents: 15000 })), 'memberA starting a snapscan payment')
    paymentId = row.id
    paymentReference = row.merchant_reference
    assert.ok(paymentReference.startsWith('ELCSA-'))
    const { data: dbRow } = await admin.from('snapscan_payments').select('*').eq('id', paymentId).single()
    assert.equal(dbRow.profile_id, memberA.id)
    assert.equal(dbRow.congregation_id, congA.id)
    assert.equal(dbRow.amount_cents, 15000)
    assert.equal(dbRow.status, 'pending')
  })

  test('create_snapscan_payment accepts a payment code from the caller\'s own congregation', async () => {
    const [row] = await expectOk(
      rpcRetryColdSchemaCache(() => memberA.client.rpc('create_snapscan_payment', { p_amount_cents: 5000, p_payment_code_id: paymentCodeA })),
      'memberA starting a snapscan payment with a purpose'
    )
    const { data: dbRow } = await admin.from('snapscan_payments').select('payment_code_id').eq('id', row.id).single()
    assert.equal(dbRow.payment_code_id, paymentCodeA)
  })

  test('create_snapscan_payment rejects a payment code from another congregation', async () => {
    await expectError(
      rpcRetryColdSchemaCache(() => memberA.client.rpc('create_snapscan_payment', { p_amount_cents: 5000, p_payment_code_id: paymentCodeB })),
      'Invalid payment code',
      'memberA using congB\'s payment code'
    )
  })

  test('a member cannot forge a snapscan_payments row via a raw insert', async () => {
    await expectError(
      memberA.client.from('snapscan_payments').insert({ congregation_id: congA.id, profile_id: memberA.id, merchant_reference: 'FORGED-REF', amount_cents: 100 }),
      null,
      'memberA raw-inserting a snapscan payment'
    )
  })

  test('memberA can read their own pending payment; memberB (same congregation) and adminB (other congregation) cannot', async () => {
    const { data: seenByOwner } = await memberA.client.from('snapscan_payments').select('id').eq('id', paymentId)
    assert.equal(seenByOwner.length, 1)
    const { data: seenByOtherMember } = await memberB.client.from('snapscan_payments').select('id').eq('id', paymentId)
    assert.equal(seenByOtherMember.length, 0)
    const { data: seenByOtherAdmin } = await adminB.client.from('snapscan_payments').select('id').eq('id', paymentId)
    assert.equal(seenByOtherAdmin.length, 0)
  })

  test('adminA (same congregation) can read memberA\'s payment', async () => {
    const { data: seenByAdmin } = await adminA.client.from('snapscan_payments').select('id').eq('id', paymentId)
    assert.equal(seenByAdmin.length, 1)
  })

  test('a member cannot update a payment\'s status directly (only the webhook, via service_role, can)', async () => {
    // No UPDATE policy exists on this table at all, so — same caveat already
    // documented in NOTES.md for other tables — this silently affects 0 rows
    // rather than throwing; assert the real invariant (status unchanged).
    const { data: updateResult } = await memberA.client.from('snapscan_payments').update({ status: 'completed' }).eq('id', paymentId).select()
    assert.equal((updateResult ?? []).length, 0)
    const { data: row } = await admin.from('snapscan_payments').select('status').eq('id', paymentId).single()
    assert.equal(row.status, 'pending')
  })
})

after(async () => {
  // Best-effort cleanup so repeated runs against the same local instance
  // don't accumulate test users/congregations. Not load-bearing for the
  // assertions above — a `supabase db reset` also wipes all of this.
  for (const u of [adminA, memberA, adminB, memberB, memberA2, memberA3]) {
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
  if (mintedHouseholdIds.length) {
    try {
      await admin.from('households').delete().in('id', mintedHouseholdIds)
    } catch {}
  }
})
