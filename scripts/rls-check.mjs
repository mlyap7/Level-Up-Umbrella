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

// Welcome-flow fields
const setup = await alice.c.from('profiles').update({ goal_weight_kg: 65, coaching_started_on: '2026-03-01', onboarded_at: new Date().toISOString() }).eq('id', alice.id).select()
check('client can fill in welcome-flow fields', !setup.error && setup.data?.length === 1)
const bobGoal = await bob.c.from('profiles').update({ goal_weight_kg: 1 }).eq('id', alice.id).select()
check('client cannot edit someone else\'s goal weight', (bobGoal.data ?? []).length === 0)

// Progress photos: table + private storage
const jpeg = new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' })
const alicePath = `${alice.id}/test-${stamp}.jpg`
const up = await alice.c.storage.from('progress-photos').upload(alicePath, jpeg, { contentType: 'image/jpeg' })
check('client can upload a photo to own folder', !up.error)
const bobUp = await bob.c.storage.from('progress-photos').upload(`${alice.id}/sneaky-${stamp}.jpg`, jpeg, { contentType: 'image/jpeg' })
check('client cannot upload into someone else\'s folder', !!bobUp.error)
const row = await alice.c.from('progress_photos').insert({ client_id: alice.id, pose: 'front', storage_path: alicePath }).select('id').single()
check('client can save a photo record', !row.error)
const badRow = await bob.c.from('progress_photos').insert({ client_id: bob.id, pose: 'front', storage_path: alicePath })
check('photo record cannot point at another client\'s file', !!badRow.error)
const { data: bobPhotos } = await bob.c.from('progress_photos').select('id')
check('client cannot see other clients\' photo records', bobPhotos.length === 0)
const bobUrl = await bob.c.storage.from('progress-photos').createSignedUrl(alicePath, 60)
check('client cannot get a link to another client\'s photo', !!bobUrl.error || !bobUrl.data?.signedUrl)
const bobDl = await bob.c.storage.from('progress-photos').download(alicePath)
check('client cannot download another client\'s photo', !!bobDl.error)
const anonDl = await anon.storage.from('progress-photos').download(alicePath)
check('logged-out visitors cannot download photos', !!anonDl.error)
const coachUrl = await coach.c.storage.from('progress-photos').createSignedUrl(alicePath, 60)
check('coach can view client photos', !coachUrl.error && !!coachUrl.data?.signedUrl)
const coachDel = await coach.c.storage.from('progress-photos').remove([alicePath])
const stillThere = await alice.c.storage.from('progress-photos').download(alicePath)
check('coach cannot delete client photos', !stillThere.error && (coachDel.data ?? []).length === 0)
const del = await alice.c.storage.from('progress-photos').remove([alicePath])
check('client can delete own photo', !del.error && (del.data ?? []).length === 1)

// Questionnaire, body stats and Google Form import
const bs = await alice.c.from('profiles').update({ has_smart_scale: true, main_goal: 'Get strong' }).eq('id', alice.id).select()
check('client can switch on smart scale and set main goal', !bs.error && bs.data?.length === 1)
const stats = await alice.c.from('daily_logs').upsert({ client_id: alice.id, log_date: '2026-09-03', weight_kg: 79, body_fat_pct: 28.4, muscle_mass_kg: 50.2, visceral_fat: 9, water_l: 2.5 }, { onConflict: 'client_id,log_date' })
check('client can log body stats and water', !stats.error)
const qa = await alice.c.from('questionnaire_responses').upsert({ client_id: alice.id, answers: { age: 30, occupation: 'Tester' } }, { onConflict: 'client_id' })
check('client can save own questionnaire', !qa.error)
const { data: bobQ } = await bob.c.from('questionnaire_responses').select('client_id')
check('client cannot read other questionnaires', bobQ.length === 0)
const bobQw = await bob.c.from('questionnaire_responses').update({ answers: {} }).eq('client_id', alice.id).select()
check('client cannot change someone else\'s questionnaire', (bobQw.data ?? []).length === 0)
const bobQi = await bob.c.from('questionnaire_responses').insert({ client_id: alice.id, answers: {} })
check('client cannot create a questionnaire for someone else', !!bobQi.error)
const { data: coachQ } = await coach.c.from('questionnaire_responses').select('client_id').eq('client_id', alice.id)
check('coach can read client questionnaires', coachQ.length === 1)

sql(`insert into public.questionnaire_imports (email, answers, main_goal, goal_note, height_cm, goal_weight_kg, submitted_at)
     values ('${bob.email.toLowerCase()}', '{"age": 41, "occupation": "Imported"}', 'Imported goal', 'Imported why', 172, 70, now())`)
const { data: imps } = await bob.c.from('questionnaire_imports').select('email')
check('clients cannot read the import table', (imps ?? []).length === 0)
const applyRpc = await bob.c.rpc('apply_questionnaire_import', { target: bob.id, target_email: bob.email })
check('clients cannot run the raw import function', !!applyRpc.error)
const aliceClaim = await alice.c.rpc('claim_questionnaire_import')
check('a client cannot claim answers that are not theirs', aliceClaim.data === false)
const bobClaim = await bob.c.rpc('claim_questionnaire_import')
const { data: bobRow } = await bob.c.from('questionnaire_responses').select('answers, imported, submitted_at').eq('client_id', bob.id).single()
const { data: bobProf } = await bob.c.from('profiles').select('main_goal, goal_note, height_cm').eq('id', bob.id).single()
check('client claims their own imported answers', bobClaim.data === true && bobRow?.imported === true && bobRow?.answers?.occupation === 'Imported' && !!bobRow?.submitted_at)
check('import fills empty profile fields', bobProf?.main_goal === 'Imported goal' && Number(bobProf?.height_cm) === 172)
const again = await bob.c.rpc('claim_questionnaire_import')
check('claiming twice does nothing', again.data === false)

// Coach team: head coach sees everyone; other coaches see clients and themselves
const head = await user('head')
const coach2 = await user('coach2')
sql(`update public.profiles set role = 'coach', head_coach = true where id = '${head.id}'`)
sql(`update public.profiles set role = 'coach' where id = '${coach2.id}'`)
const flagSelf = await coach.c.from('profiles').update({ head_coach: true }).eq('id', coach.id)
check('a coach cannot make themselves head coach', !!flagSelf.error)

await coach2.c.from('daily_logs').insert({ client_id: coach2.id, log_date: '2026-09-01', weight_kg: 60 })
const c2ci = await coach2.c.from('check_ins').insert({ client_id: coach2.id, week_start: '2026-09-21', adherence: 8, energy: 7, hunger: 5, sleep_quality: 7, stress: 4, digestion: 7 }).select('id').single()
check('a coach can log their own data and check-in', !c2ci.error)
const c2path = `${coach2.id}/me-${stamp}.jpg`
await coach2.c.storage.from('progress-photos').upload(c2path, jpeg, { contentType: 'image/jpeg' })

const { data: coachSeesC2 } = await coach.c.from('daily_logs').select('id').eq('client_id', coach2.id)
check('a coach cannot see another coach’s logs', coachSeesC2.length === 0)
const { data: coachSeesC2Prof } = await coach.c.from('profiles').select('id').eq('id', coach2.id)
check('a coach cannot see another coach’s profile', coachSeesC2Prof.length === 0)
const coachC2Url = await coach.c.storage.from('progress-photos').createSignedUrl(c2path, 60)
check('a coach cannot view another coach’s photos', !!coachC2Url.error || !coachC2Url.data?.signedUrl)
const coachC2Reply = await coach.c.from('check_in_comments').insert({ check_in_id: c2ci.data.id, author_id: coach.id, body: 'peek' })
check('a coach cannot reply to another coach’s check-in', !!coachC2Reply.error)
const { data: coachSeesAlice } = await coach.c.from('daily_logs').select('id').eq('client_id', alice.id)
check('a coach still sees clients', coachSeesAlice.length >= 1)
const { data: headProfiles } = await head.c.from('profiles').select('id').in('id', [coach.id, coach2.id, alice.id])
check('head coach sees coaches and clients', headProfiles.length === 3)
const { data: headSeesC2 } = await head.c.from('daily_logs').select('id').eq('client_id', coach2.id)
check('head coach sees a coach’s logs', headSeesC2.length === 1)
const headUrl = await head.c.storage.from('progress-photos').createSignedUrl(c2path, 60)
check('head coach can view a coach’s photos', !headUrl.error && !!headUrl.data?.signedUrl)
const headReply = await head.c.from('check_in_comments').insert({ check_in_id: c2ci.data.id, author_id: head.id, body: 'Proud of you' })
check('head coach can reply to a coach’s check-in', !headReply.error)
const { data: c2Comments } = await coach2.c.from('check_in_comments').select('body, author_name')
check('the coach sees the reply with the head coach’s name', c2Comments.some((c) => c.body === 'Proud of you' && c.author_name === 'head'))
const ownProg = await coach2.c.from('programs').insert({ client_id: coach2.id, name: 'My block' })
check('a coach can write their own program', !ownProg.error)
const otherCoachProg = await coach.c.from('programs').insert({ client_id: coach2.id, name: 'Nope' })
check('a coach cannot write another coach’s program', !!otherCoachProg.error)
const headProg = await head.c.from('programs').insert({ client_id: coach2.id, name: 'From head' })
check('head coach can write a coach’s program', !headProg.error)

const clientMake = await alice.c.rpc('set_coach', { target: alice.id, make: true })
check('a client cannot make themselves coach', !!clientMake.error)
const coachMake = await coach.c.rpc('set_coach', { target: alice.id, make: true })
check('only the head coach can make coaches', !!coachMake.error && sql(`select role from public.profiles where id = '${alice.id}'`) === 'client')
const demoteHead = await coach2.c.rpc('set_coach', { target: head.id, make: false })
check('a coach cannot demote the head coach', !!demoteHead.error)
const headSelf = await head.c.rpc('set_coach', { target: head.id, make: false })
check('head coach cannot change their own role', !!headSelf.error)
const make = await head.c.rpc('set_coach', { target: alice.id, make: true })
check('head coach can make a client a coach', !make.error && sql(`select role from public.profiles where id = '${alice.id}'`) === 'coach')
const { data: coachSeesAliceNow } = await coach.c.from('daily_logs').select('id').eq('client_id', alice.id)
check('once promoted, other coaches no longer see her data', coachSeesAliceNow.length === 0)
const unmake = await head.c.rpc('set_coach', { target: alice.id, make: false })
check('head coach can undo it', !unmake.error && sql(`select role from public.profiles where id = '${alice.id}'`) === 'client')

// Program templates and one-step programs
const draft = [{ name: 'Day A', exercises: [{ name: 'Goblet squat', sets: 3, reps: '8-10', rpe: 7, rest: '90s', tempo: '3-1-1', notes: 'Chest tall', video_url: '' }] }]
const { data: clientTpl } = await alice.c.from('program_templates').select('id')
check('clients cannot see templates', (clientTpl ?? []).length === 0)
const clientTplW = await alice.c.from('program_templates').insert({ name: `x-${stamp}`, workouts: [] })
check('clients cannot create templates', !!clientTplW.error)
const coachTpl = await coach.c.from('program_templates').insert({ name: `Test ${stamp}`, workouts: draft }).select('id').single()
check('coaches can create templates', !coachTpl.error)
const { data: seeded } = await coach.c.from('program_templates').select('name')
check('starter templates are there for coaches', seeded.length >= 9)
const selfDraft = await alice.c.rpc('create_program_from_draft', { target: alice.id, p_name: 'Mine', p_notes: '', p_workouts: draft })
check('a client cannot create a program for themselves', !!selfDraft.error)
const fromDraft = await coach.c.rpc('create_program_from_draft', { target: bob.id, p_name: 'From template', p_notes: 'Notes', p_workouts: draft })
const { data: bobNew } = await bob.c.from('programs').select('name, workouts:program_workouts(name, exercises:workout_exercises(name, rest, tempo))').eq('id', fromDraft.data)
check('a coach can give a client a whole program in one step', !fromDraft.error && bobNew?.[0]?.workouts?.[0]?.exercises?.[0]?.tempo === '3-1-1')
const otherCoachDraft = await coach.c.rpc('create_program_from_draft', { target: coach2.id, p_name: 'Nope', p_notes: '', p_workouts: draft })
check('a coach cannot give another coach a program', !!otherCoachDraft.error)
const badVideo = await coach.c.from('workout_exercises').update({ video_url: 'javascript:alert(1)' }).eq('name', 'Squat').select()
check('video links must be web links', !!badVideo.error)

console.log(failures === 0 ? '\nAll security checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
