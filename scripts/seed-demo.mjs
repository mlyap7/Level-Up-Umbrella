// Fills a LOCAL Supabase with a demo coach and client so you can click around.
// Never point this at your live project.
// Usage: API_URL=... ANON_KEY=... DB_URL=... node scripts/seed-demo.mjs
import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'

const { API_URL, ANON_KEY, DB_URL } = process.env
if (!/127\.0\.0\.1|localhost/.test(API_URL ?? '')) throw new Error('Refusing to seed a non-local database.')
const sql = (q) => execFileSync('psql', [DB_URL, '-tAc', q], { encoding: 'utf8' }).trim()

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const monday = (n) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * n); return iso(d) }

async function account(email, name) {
  const c = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
  let { data, error } = await c.auth.signUp({ email, password: 'password123', options: { data: { full_name: name } } })
  if (error?.message?.includes('already')) ({ data, error } = await c.auth.signInWithPassword({ email, password: 'password123' }))
  if (error) throw error
  return { c, id: data.user.id }
}

const coach = await account('coach@demo.test', 'Coach Demo')
sql(`update public.profiles set role = 'coach' where id = '${coach.id}'`)
const sarah = await account('sarah@demo.test', 'Sarah Tan')
const jay = await account('jay@demo.test', 'Jay Lim')
await sarah.c.from('profiles').update({ goal_type: 'lose', goal_note: 'Drop a dress size before my wedding in March and feel strong.', height_cm: 163 }).eq('id', sarah.id)
await jay.c.from('profiles').update({ goal_type: 'lose' }).eq('id', jay.id)
// Mark demo clients as having finished the welcome flow (ignored if that database update isn't applied).
for (const [who, started, goal] of [[sarah, daysAgo(42), 64], [jay, daysAgo(30), 80]]) {
  await who.c.from('profiles').update({ onboarded_at: new Date().toISOString(), coaching_started_on: started, goal_weight_kg: goal }).eq('id', who.id)
}

// Sarah: 6 weeks of mostly-daily weigh-ins trending down with realistic noise.
const logs = []
for (let i = 42; i >= 0; i--) {
  if (i % 7 === 3 && i > 5) continue // misses a day now and then
  const trend = 72.4 - (42 - i) * 0.055
  const noise = Math.sin(i * 1.7) * 0.45 + (i % 7 === 1 ? 0.5 : 0) // weekend bump
  logs.push({ client_id: sarah.id, log_date: daysAgo(i), weight_kg: +(trend + noise).toFixed(1), steps: 7000 + ((i * 1337) % 5000), sleep_hours: 6 + (i % 3) * 0.5 })
}
await sarah.c.from('daily_logs').upsert(logs, { onConflict: 'client_id,log_date' })

const { data: types } = await sarah.c.from('measurement_types').select('id, name')
const waist = types.find((t) => t.name === 'Waist').id
const hips = types.find((t) => t.name === 'Hips').id
const m = []
for (let w = 6; w >= 0; w--) {
  m.push({ client_id: sarah.id, type_id: waist, measured_on: daysAgo(w * 7), value_cm: +(78 - (6 - w) * 0.45).toFixed(1) })
  m.push({ client_id: sarah.id, type_id: hips, measured_on: daysAgo(w * 7), value_cm: +(99 - (6 - w) * 0.3).toFixed(1) })
}
await sarah.c.from('measurements').upsert(m, { onConflict: 'type_id,measured_on' })

// Jay: stalled and not logging lately.
const jlogs = []
for (let i = 30; i >= 5; i--) jlogs.push({ client_id: jay.id, log_date: daysAgo(i), weight_kg: +(88 + Math.sin(i) * 0.4).toFixed(1) })
await jay.c.from('daily_logs').upsert(jlogs, { onConflict: 'client_id,log_date' })

// Check-ins
const { data: ci1 } = await sarah.c.from('check_ins').upsert({ client_id: sarah.id, week_start: monday(2), adherence: 8, energy: 7, hunger: 6, sleep_quality: 7, stress: 5, digestion: 8, wins: 'Hit my step goal 6/7 days.', struggles: 'Late-night snacking on Friday.', questions: '' }, { onConflict: 'client_id,week_start' }).select().single()
await coach.c.from('check_in_comments').insert({ check_in_id: ci1.id, author_id: coach.id, body: 'Great week Sarah! For Friday, try having your protein snack ready after dinner.' })
await sarah.c.from('check_ins').upsert({ client_id: sarah.id, week_start: monday(1), adherence: 7, energy: 4, hunger: 7, sleep_quality: 5, stress: 8, digestion: 7, wins: 'Squat felt strong, first time at 60kg!', struggles: 'Work deadlines, slept badly Tue/Wed.', questions: 'Should I still train on days I slept under 6 hours?' }, { onConflict: 'client_id,week_start' })
await jay.c.from('check_ins').upsert({ client_id: jay.id, week_start: monday(3), adherence: 4, energy: 5, hunger: 8, sleep_quality: 6, stress: 6, digestion: 6, wins: '', struggles: 'Travelling for work', questions: '' }, { onConflict: 'client_id,week_start' })

await sarah.c.from('journal_entries').insert([
  { client_id: sarah.id, entry_date: daysAgo(1), mood: 4, body: 'Felt good today. Meal prepped for the week and went for a long walk.' },
  { client_id: sarah.id, entry_date: daysAgo(4), mood: 2, body: 'Stressful day at work, skipped lunch then overate at dinner. Tomorrow is a new day.' },
])

// Program + a couple of sessions
const { data: existing } = await coach.c.from('programs').select('id').eq('client_id', sarah.id)
if (existing.length === 0) {
  const { data: prog } = await coach.c.from('programs').insert({ client_id: sarah.id, name: 'Block 1: Foundations', notes: '3 sessions a week. Leave 1 to 2 reps in the tank on every set.' }).select().single()
  const { data: a } = await coach.c.from('program_workouts').insert({ program_id: prog.id, name: 'Day A: Lower', position: 0 }).select().single()
  const { data: b } = await coach.c.from('program_workouts').insert({ program_id: prog.id, name: 'Day B: Upper', position: 1 }).select().single()
  // Bulk inserts send null for missing keys, so give every row every column.
  const ex = (workout_id, position, name, target_sets, target_reps, target_rpe = null, notes = '') =>
    ({ workout_id, position, name, target_sets, target_reps, target_rpe, notes })
  const { error: exErr } = await coach.c.from('workout_exercises').insert([
    ex(a.id, 0, 'Back squat', 3, '6-8', 8, 'Pause 1s at the bottom'),
    ex(a.id, 1, 'Romanian deadlift', 3, '8-10', 7),
    ex(a.id, 2, 'Walking lunge', 2, '12 each'),
    ex(b.id, 0, 'Dumbbell bench press', 3, '8-10', 8),
    ex(b.id, 1, 'Lat pulldown', 3, '10-12'),
  ])
  if (exErr) throw exErr
  const { data: s1 } = await sarah.c.from('workout_sessions').insert({ client_id: sarah.id, workout_id: a.id, workout_name: 'Day A: Lower', performed_on: daysAgo(3), feeling: 4, remarks: 'Squats felt smooth. Left knee a bit tight on lunges.' }).select().single()
  await sarah.c.from('session_sets').insert([
    { session_id: s1.id, exercise_name: 'Back squat', set_number: 1, weight_kg: 57.5, reps: 8, rpe: 7 },
    { session_id: s1.id, exercise_name: 'Back squat', set_number: 2, weight_kg: 60, reps: 7, rpe: 8 },
    { session_id: s1.id, exercise_name: 'Back squat', set_number: 3, weight_kg: 60, reps: 6, rpe: 8.5 },
    { session_id: s1.id, exercise_name: 'Romanian deadlift', set_number: 1, weight_kg: 50, reps: 10 },
    { session_id: s1.id, exercise_name: 'Romanian deadlift', set_number: 2, weight_kg: 50, reps: 10 },
  ])
}
console.log('Demo data ready. Log in as coach@demo.test or sarah@demo.test, password: password123')
