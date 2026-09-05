// One-off provisioning script: creates a generic login for each league,
// already set up as that league's admin — so a league doesn't need a real
// member's account manually promoted just to manage its own tools.
//
// This is NOT a migration. It calls the Supabase Auth *admin* API, which
// needs the project's service role key — a secret that must never be
// committed or hardcoded. Run it locally:
//
//   1. Create a file named `.env.service.local` in this directory (mobile-app/)
//      — that name is already covered by .gitignore's `.env*.local` pattern.
//      Put in it:
//        SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY   (Project Settings > API — "service_role", not "anon")
//   2. node --env-file=.env.service.local scripts/create-league-admin-accounts.mjs
//
// Each account gets a freshly generated random password, printed once at
// the end — nothing is written to any file. Save it somewhere safe (a
// password manager, not this repo) and hand it to whoever runs that league.
// Re-running is safe: leagues that already have an account are skipped.

import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. See the comment at the top of this file for setup.')
  process.exit(1)
}

// Change this if your real congregation domain differs — these addresses
// only need to be syntactically valid and unique, nobody reads this inbox.
const EMAIL_DOMAIN = 'league-admin.elcsatcp.internal'
const CONGREGATION_SLUG = 'tshwane-city-parish'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

function generatePassword() {
  return randomBytes(15).toString('base64url') // ~20 chars, URL-safe, no ambiguity issues
}

async function main() {
  const { data: congregation, error: congErr } = await supabase.from('congregations').select('id').eq('slug', CONGREGATION_SLUG).single()
  if (congErr || !congregation) throw new Error(`Could not find congregation "${CONGREGATION_SLUG}": ${congErr?.message}`)

  const { data: defaultWard, error: wardErr } = await supabase
    .from('wards')
    .select('id, name')
    .eq('congregation_id', congregation.id)
    .order('name')
    .limit(1)
    .single()
  if (wardErr || !defaultWard) throw new Error(`Could not find a ward to assign these accounts to: ${wardErr?.message}`)

  const { data: leagues, error: leaguesErr } = await supabase.from('leagues').select('id, key, label').eq('congregation_id', congregation.id).order('label')
  if (leaguesErr) throw new Error(`Could not load leagues: ${leaguesErr.message}`)

  const results = []

  for (const league of leagues) {
    const email = `${league.key.toLowerCase()}@${EMAIL_DOMAIN}`

    const { data: existing } = await supabase.auth.admin.listUsers()
    const already = existing?.users?.find((u) => u.email === email)
    if (already) {
      results.push({ league: league.label, email, password: '(already exists — unchanged)' })
      continue
    }

    const password = generatePassword()
    // full_name's last word doubles as the derived "surname" for family
    // matching (0017) — using the league's own unique key keeps every
    // league account from accidentally auto-merging into one shared family.
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `League Admin ${league.key}`,
        congregation_id: congregation.id,
        ward_id: defaultWard.id,
        is_service_account: true,
      },
    })
    if (createErr || !created.user) {
      results.push({ league: league.label, email, password: `FAILED: ${createErr?.message}` })
      continue
    }

    const { error: adminErr } = await supabase.from('league_admins').insert({ profile_id: created.user.id, league_id: league.id })
    if (adminErr) {
      results.push({ league: league.label, email, password: `Account created but league_admins insert FAILED: ${adminErr.message}` })
      continue
    }

    results.push({ league: league.label, email, password })
  }

  console.log(`\nDefault ward for these accounts: ${defaultWard.name}\n`)
  console.log('League'.padEnd(28) + 'Email'.padEnd(45) + 'Password')
  console.log('-'.repeat(100))
  for (const r of results) {
    console.log(r.league.padEnd(28) + r.email.padEnd(45) + r.password)
  }
  console.log('\nSave these now — passwords are not stored anywhere and this won\'t be shown again.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
