// All database access lives here so pages stay about UI.
import { supabase, unwrap } from './supabase'
import type {
  CheckIn, CheckInComment, DailyLog, JournalEntry, Measurement, MeasurementType,
  Profile, Program, ProgramWorkout, SessionSet, WorkoutExercise, WorkoutSession,
} from './types'

// Supabase returns numeric columns as strings; normalise them.
const num = (v: unknown): number | null => (v == null ? null : Number(v))

// ---------------------------------------------------------------- profiles

export async function updateProfile(id: string, patch: Partial<Pick<Profile,
  'full_name' | 'weight_unit' | 'length_unit' | 'goal_type' | 'goal_note' | 'height_cm'>>) {
  unwrap(await supabase.from('profiles').update(patch).eq('id', id))
}

export async function getProfile(id: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select('*').eq('id', id).single()) as Profile
}

export async function listClients(): Promise<Profile[]> {
  return unwrap(await supabase.from('profiles').select('*').eq('role', 'client').order('full_name')) as Profile[]
}

export async function setClientArchived(id: string, archive: boolean) {
  unwrap(await supabase.rpc('set_client_archived', { target: id, archive }))
}

export async function getSignupCode(): Promise<string> {
  const row = unwrap(await supabase.from('app_settings').select('signup_code').single()) as { signup_code: string | null }
  return row.signup_code ?? ''
}

export async function setSignupCode(code: string) {
  unwrap(await supabase.from('app_settings').update({ signup_code: code.trim() || null }).eq('id', true))
}

export async function checkSignupCode(code: string): Promise<boolean> {
  return unwrap(await supabase.rpc('check_signup_code', { code })) as boolean
}

// ---------------------------------------------------------------- daily logs

function toDailyLog(r: Record<string, unknown>): DailyLog {
  return { ...(r as unknown as DailyLog), weight_kg: num(r.weight_kg), sleep_hours: num(r.sleep_hours), steps: num(r.steps) }
}

export async function listDailyLogs(clientId: string, since?: string): Promise<DailyLog[]> {
  let q = supabase.from('daily_logs').select('*').eq('client_id', clientId).order('log_date')
  if (since) q = q.gte('log_date', since)
  return (unwrap(await q) as Record<string, unknown>[]).map(toDailyLog)
}

export async function listAllDailyLogs(since: string): Promise<DailyLog[]> {
  const rows = unwrap(await supabase.from('daily_logs')
    .select('client_id, log_date, weight_kg').gte('log_date', since).order('log_date'))
  return (rows as Record<string, unknown>[]).map(toDailyLog)
}

export async function upsertDailyLog(clientId: string, log: Pick<DailyLog, 'log_date' | 'weight_kg' | 'steps' | 'sleep_hours'>) {
  unwrap(await supabase.from('daily_logs').upsert({ client_id: clientId, ...log }, { onConflict: 'client_id,log_date' }))
}

export async function deleteDailyLog(id: string) {
  unwrap(await supabase.from('daily_logs').delete().eq('id', id))
}

// ---------------------------------------------------------------- measurements

export async function listMeasurementTypes(clientId: string): Promise<MeasurementType[]> {
  return unwrap(await supabase.from('measurement_types').select('*')
    .eq('client_id', clientId).order('position').order('created_at')) as MeasurementType[]
}

export async function addMeasurementType(clientId: string, name: string, position: number) {
  unwrap(await supabase.from('measurement_types').insert({ client_id: clientId, name: name.trim(), position }))
}

export async function setMeasurementTypeArchived(id: string, archived: boolean) {
  unwrap(await supabase.from('measurement_types').update({ archived }).eq('id', id))
}

export async function renameMeasurementType(id: string, name: string) {
  unwrap(await supabase.from('measurement_types').update({ name: name.trim() }).eq('id', id))
}

export async function listMeasurements(clientId: string): Promise<Measurement[]> {
  const rows = unwrap(await supabase.from('measurements').select('*').eq('client_id', clientId).order('measured_on'))
  return (rows as Record<string, unknown>[]).map((r) => ({ ...(r as unknown as Measurement), value_cm: Number(r.value_cm) }))
}

export async function upsertMeasurements(clientId: string, measuredOn: string, values: { type_id: string; value_cm: number }[]) {
  if (values.length === 0) return
  unwrap(await supabase.from('measurements').upsert(
    values.map((v) => ({ client_id: clientId, measured_on: measuredOn, ...v })),
    { onConflict: 'type_id,measured_on' },
  ))
}

export async function deleteMeasurement(id: string) {
  unwrap(await supabase.from('measurements').delete().eq('id', id))
}

// ---------------------------------------------------------------- journal

export async function listJournal(clientId: string): Promise<JournalEntry[]> {
  return unwrap(await supabase.from('journal_entries').select('*').eq('client_id', clientId)
    .order('entry_date', { ascending: false }).order('created_at', { ascending: false })) as JournalEntry[]
}

export async function addJournal(clientId: string, entry: Pick<JournalEntry, 'entry_date' | 'mood' | 'body'>) {
  unwrap(await supabase.from('journal_entries').insert({ client_id: clientId, ...entry }))
}

export async function deleteJournal(id: string) {
  unwrap(await supabase.from('journal_entries').delete().eq('id', id))
}

// ---------------------------------------------------------------- check-ins

export type CheckInFields = Omit<CheckIn, 'id' | 'client_id' | 'created_at'>

export async function listCheckIns(clientId: string): Promise<CheckIn[]> {
  return unwrap(await supabase.from('check_ins').select('*').eq('client_id', clientId)
    .order('week_start', { ascending: false })) as CheckIn[]
}

export async function listRecentCheckIns(since: string): Promise<CheckIn[]> {
  return unwrap(await supabase.from('check_ins').select('*').gte('week_start', since)
    .order('week_start', { ascending: false })) as CheckIn[]
}

export async function upsertCheckIn(clientId: string, fields: CheckInFields) {
  unwrap(await supabase.from('check_ins').upsert({ client_id: clientId, ...fields }, { onConflict: 'client_id,week_start' }))
}

export async function listComments(checkInIds: string[]): Promise<CheckInComment[]> {
  if (checkInIds.length === 0) return []
  return unwrap(await supabase.from('check_in_comments').select('*')
    .in('check_in_id', checkInIds).order('created_at')) as CheckInComment[]
}

export async function addComment(checkInId: string, authorId: string, body: string) {
  unwrap(await supabase.from('check_in_comments').insert({ check_in_id: checkInId, author_id: authorId, body: body.trim() }))
}

export async function deleteComment(id: string) {
  unwrap(await supabase.from('check_in_comments').delete().eq('id', id))
}

// ---------------------------------------------------------------- training

export interface FullWorkout extends ProgramWorkout {
  exercises: WorkoutExercise[]
}

export interface FullProgram extends Program {
  workouts: FullWorkout[]
}

export async function listPrograms(clientId: string): Promise<FullProgram[]> {
  const rows = unwrap(await supabase.from('programs')
    .select('*, workouts:program_workouts(*, exercises:workout_exercises(*))')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })) as FullProgram[]
  for (const p of rows) {
    p.workouts.sort((a, b) => a.position - b.position)
    for (const w of p.workouts) {
      w.exercises.sort((a, b) => a.position - b.position)
      for (const e of w.exercises) e.target_rpe = num(e.target_rpe)
    }
  }
  return rows
}

export async function createProgram(clientId: string, name: string): Promise<string> {
  const row = unwrap(await supabase.from('programs').insert({ client_id: clientId, name: name.trim() }).select('id').single())
  return (row as { id: string }).id
}

export async function updateProgram(id: string, patch: Partial<Pick<Program, 'name' | 'notes' | 'active'>>) {
  unwrap(await supabase.from('programs').update(patch).eq('id', id))
}

export async function deleteProgram(id: string) {
  unwrap(await supabase.from('programs').delete().eq('id', id))
}

export async function addWorkout(programId: string, name: string, position: number) {
  unwrap(await supabase.from('program_workouts').insert({ program_id: programId, name: name.trim(), position }))
}

export async function updateWorkout(id: string, patch: Partial<Pick<ProgramWorkout, 'name' | 'position'>>) {
  unwrap(await supabase.from('program_workouts').update(patch).eq('id', id))
}

export async function deleteWorkout(id: string) {
  unwrap(await supabase.from('program_workouts').delete().eq('id', id))
}

export type ExerciseFields = Pick<WorkoutExercise, 'name' | 'target_sets' | 'target_reps' | 'target_rpe' | 'notes' | 'position'>

export async function addExercise(workoutId: string, fields: ExerciseFields) {
  unwrap(await supabase.from('workout_exercises').insert({ workout_id: workoutId, ...fields }))
}

export async function updateExercise(id: string, patch: Partial<ExerciseFields>) {
  unwrap(await supabase.from('workout_exercises').update(patch).eq('id', id))
}

export async function deleteExercise(id: string) {
  unwrap(await supabase.from('workout_exercises').delete().eq('id', id))
}

export interface FullSession extends WorkoutSession {
  sets: SessionSet[]
}

function toSet(s: Record<string, unknown>): SessionSet {
  return { ...(s as unknown as SessionSet), weight_kg: num(s.weight_kg), rpe: num(s.rpe), reps: num(s.reps) }
}

export async function listSessions(clientId: string, limit = 50): Promise<FullSession[]> {
  const rows = unwrap(await supabase.from('workout_sessions').select('*, sets:session_sets(*)')
    .eq('client_id', clientId)
    .order('performed_on', { ascending: false }).order('created_at', { ascending: false })
    .limit(limit)) as (WorkoutSession & { sets: Record<string, unknown>[] })[]
  return rows.map((r) => ({
    ...r,
    sets: r.sets.map(toSet).sort((a, b) => a.exercise_name.localeCompare(b.exercise_name) || a.set_number - b.set_number),
  }))
}

export interface NewSession {
  workout_id: string | null
  workout_name: string
  performed_on: string
  feeling: number | null
  remarks: string
  sets: Omit<SessionSet, 'id' | 'session_id'>[]
}

export async function createSession(clientId: string, s: NewSession) {
  const { sets, ...session } = s
  const row = unwrap(await supabase.from('workout_sessions').insert({ client_id: clientId, ...session }).select('id').single()) as { id: string }
  if (sets.length > 0) {
    const res = await supabase.from('session_sets').insert(sets.map((x) => ({ ...x, session_id: row.id })))
    if (res.error) {
      // Don't leave a half-saved session behind.
      await supabase.from('workout_sessions').delete().eq('id', row.id)
      throw new Error(res.error.message)
    }
  }
}

export async function deleteSession(id: string) {
  unwrap(await supabase.from('workout_sessions').delete().eq('id', id))
}
