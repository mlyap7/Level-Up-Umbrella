// Security check against a local Supabase (`npx supabase start`).
// Creates throwaway users and asserts each role can only do what it should.
// Usage: API_URL=... ANON_KEY=... DB_URL=... node scripts/rls-check.mjs
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'

const { API_URL, ANON_KEY, DB_URL } = process.env
const sql = (q) => execFileSync('psql', [DB_URL, '-tAc', q], { encoding: 'utf8' }).trim()
let failures = 0
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) failures++ }

const stamp = Date.now()
async function user(label, meta = {}) {
  const c = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
  const email = `${label}-${stamp}@example.com`
  const { data, error } = await c.auth.signUp({ email, password: 'password123', options: { data: { full_name: label, ...meta } } })
  if (error) throw new Error(`${label}: ${error.message}`)
  return { c, id: data.user.id, email }
}

const alice = await user('alice')
const bob = await user('bob')
const coach = await user('coach')
sql(`update public.profiles set role = 'coach' where id = '${coach.id}'`)

// Profiles + defaults
const { data: aProfile } = await alice.c.from('profiles').select('*').eq('id', alice.id).single()
check('profile created on sign-up with name', aProfile?.full_name === 'alice' && aProfile.role === 'client')
const { data: aTypes } = await alice.c.from('measurement_types').select('name').order('position')
check('default measurements are Waist and Hips', aTypes?.map((t) => t.name).join(',') === 'Waist,Hips')

// Privilege escalation
const esc = await alice.c.from('profiles').update({ role: 'coach' }).eq('id', alice.id)
check('client cannot make themselves coach', !!esc.error)
const arch = await alice.c.rpc('set_client_archived', { target: bob.id, archive: true })
check('client cannot archive others', !!arch.error)

// Data isolation
await alice.c.from('daily_logs').insert({ client_id: alice.id, log_date: '2026-09-01', weight_kg: 80 })
await bob.c.from('daily_logs').insert({ client_id: bob.id, log_date: '2026-09-01', weight_kg: 90 })
const { data: bobSees } = await bob.c.from('daily_logs').select('client_id')
check('client only sees own logs', bobSees.every((r) => r.client_id === bob.id) && bobSees.length === 1)
const forge = await bob.c.from('daily_logs').insert({ client_id: alice.id, log_date: '2026-09-02', weight_kg: 1 })
check('client cannot write logs for someone else', !!forge.error)
const { data: bobProfiles } = await bob.c.from('profiles').select('id')
check('client only sees own profile', bobProfiles.length === 1)

const aliceWaist = (await alice.c.from('measurement_types').select('id').eq('name', 'Waist').single()).data
const crossType = await bob.c.from('measurements').insert({ client_id: bob.id, type_id: aliceWaist.id, value_cm: 70 })
check('client cannot log against another client’s measurement type', !!crossType.error)
const ownM = await alice.c.from('measurements').insert({ client_id: alice.id, type_id: aliceWaist.id, value_cm: 80 })
check('client can log own measurement', !ownM.error)

// Coach
const { data: coachLogs } = await coach.c.from('daily_logs').select('client_id')
check('coach sees every client’s logs', coachLogs.length >= 2)
const coachWrite = await coach.c.from('daily_logs').update({ weight_kg: 1 }).eq('client_id', alice.id).select()
check('coach cannot edit client logs', (coachWrite.data ?? []).length === 0)

// Programs
const prog = await coach.c.from('programs').insert({ client_id: alice.id, name: 'Block 1' }).select('id').single()
check('coach can create a program', !prog.error)
const wo = await coach.c.from('program_workouts').insert({ program_id: prog.data.id, name: 'Day A' }).select('id').single()
await coach.c.from('workout_exercises').insert({ workout_id: wo.data.id, name: 'Squat', target_sets: 3, target_reps: '5' })
const clientProg = await alice.c.from('programs').insert({ client_id: alice.id, name: 'Mine' })
check('client cannot write programs', !!clientProg.error)
const { data: bobProgs } = await bob.c.from('programs').select('id')
check('client cannot see other clients’ programs', bobProgs.length === 0)
const { data: aliceProg } = await alice.c.from('programs').select('*, workouts:program_workouts(*, exercises:workout_exercises(*))')
check('client sees own program with nested workouts', aliceProg?.[0]?.workouts?.[0]?.exercises?.[0]?.name === 'Squat')

const bobSession = await bob.c.from('workout_sessions').insert({ client_id: bob.id, workout_id: wo.data.id, workout_name: 'x' })
check('client cannot log a session against another client’s workout', !!bobSession.error)
const sess = await alice.c.from('workout_sessions').insert({ client_id: alice.id, workout_id: wo.data.id, workout_name: 'Day A' }).select('id').single()
const sets = await alice.c.from('session_sets').insert({ session_id: sess.data.id, exercise_name: 'Squat', set_number: 1, weight_kg: 100, reps: 5 })
check('client can log sets in own session', !sets.error)
const bobSets = await bob.c.from('session_sets').insert({ session_id: sess.data.id, exercise_name: 'Squat', set_number: 2, reps: 5 })
check('client cannot add sets to someone else’s session', !!bobSets.error)
const { data: coachSets } = await coach.c.from('session_sets').select('id').eq('session_id', sess.data.id)
check('coach can read client sets', coachSets.length === 1)

// Check-ins + comments
const ci = await alice.c.from('check_ins').insert({ client_id: alice.id, week_start: '2026-09-21', adherence: 8, energy: 7, hunger: 5, sleep_quality: 7, stress: 4, digestion: 7 }).select('id').single()
check('client can submit a check-in', !ci.error)
const bobComment = await bob.c.from('check_in_comments').insert({ check_in_id: ci.data.id, author_id: bob.id, body: 'hi' })
check('other clients cannot comment on a check-in', !!bobComment.error)
const coachComment = await coach.c.from('check_in_comments').insert({ check_in_id: ci.data.id, author_id: coach.id, body: 'Great week' })
check('coach can reply to a check-in', !coachComment.error)
const fakeAuthor = await alice.c.from('check_in_comments').insert({ check_in_id: ci.data.id, author_id: coach.id, body: 'spoof' })
check('client cannot post as the coach', !!fakeAuthor.error)
const { data: aliceComments } = await alice.c.from('check_in_comments').select('body')
check('client sees the coach reply', aliceComments.some((c) => c.body === 'Great week'))

// Sign-up code
const settingsRead = await alice.c.from('app_settings').select('*')
check('clients cannot read the sign-up code', (settingsRead.data ?? []).length === 0)
const setCode = await coach.c.from('app_settings').update({ signup_code: 'LEVELUP' }).eq('id', true).select()
check('coach can set the sign-up code', (setCode.data ?? []).length === 1)
const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
check('check_signup_code rejects a wrong code', (await anon.rpc('check_signup_code', { code: 'nope' })).data === false)
check('check_signup_code accepts the right code', (await anon.rpc('check_signup_code', { code: 'LEVELUP' })).data === true)
let blocked = false
try { await user('stranger') } catch { blocked = true }
check('sign-up without the code is blocked', blocked)
let allowed = true
try { await user('invited', { signup_code: 'LEVELUP' }) } catch { allowed = false }
check('sign-up with the code works', allowed)
await coach.c.from('app_settings').update({ signup_code: null }).eq('id', true)

// Archive
const archOk = await coach.c.rpc('set_client_archived', { target: bob.id, archive: true })
const bobArchived = sql(`select archived from public.profiles where id = '${bob.id}'`)
check('coach can archive a client', !archOk.error && bobArchived === 't')

console.log(failures === 0 ? '\nAll security checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
