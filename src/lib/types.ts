export type Role = 'client' | 'coach'
export type WeightUnit = 'kg' | 'lb'
export type LengthUnit = 'cm' | 'in'
export type GoalType = 'lose' | 'gain' | 'maintain'

export interface Profile {
  id: string
  full_name: string
  role: Role
  weight_unit: WeightUnit
  length_unit: LengthUnit
  goal_type: GoalType
  goal_note: string
  height_cm: number | null
  archived: boolean
  created_at: string
  // Added by the welcome-flow migration. `undefined` means the migration hasn't run yet.
  onboarded_at?: string | null
  goal_weight_kg?: number | string | null
  coaching_started_on?: string | null
  // Added by the questionnaire/body-stats migration.
  main_goal?: string
  has_smart_scale?: boolean
  // Added by the reminders migration.
  remind_morning?: boolean
  remind_checkin?: boolean
  remind_photos?: boolean
  remind_water?: boolean
  water_every_hours?: 2 | 3
  // Added by the coach-team migration.
  head_coach?: boolean
}

export interface DailyLog {
  id: string
  client_id: string
  log_date: string
  weight_kg: number | null
  steps: number | null
  sleep_hours: number | null
  water_l?: number | null
  body_fat_pct?: number | null
  muscle_mass_kg?: number | null
  visceral_fat?: number | null
}

export interface MeasurementType {
  id: string
  client_id: string
  name: string
  position: number
  archived: boolean
}

export interface Measurement {
  id: string
  client_id: string
  type_id: string
  measured_on: string
  value_cm: number
}

export interface JournalEntry {
  id: string
  client_id: string
  entry_date: string
  mood: number | null
  body: string
  created_at: string
}

export interface CheckIn {
  id: string
  client_id: string
  week_start: string
  adherence: number
  energy: number
  hunger: number
  sleep_quality: number
  stress: number
  digestion: number
  wins: string
  struggles: string
  questions: string
  created_at: string
}

export interface CheckInComment {
  id: string
  check_in_id: string
  author_id: string
  // First name of the author, filled in by the database (coach-team migration).
  author_name?: string
  body: string
  created_at: string
}

export interface Program {
  id: string
  client_id: string
  name: string
  notes: string
  active: boolean
  created_at: string
}

export interface ProgramWorkout {
  id: string
  program_id: string
  name: string
  position: number
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  position: number
  name: string
  target_sets: number | null
  target_reps: string
  target_rpe: number | null
  notes: string
}

export interface WorkoutSession {
  id: string
  client_id: string
  workout_id: string | null
  workout_name: string
  performed_on: string
  feeling: number | null
  remarks: string
  created_at: string
}

export interface SessionSet {
  id: string
  session_id: string
  exercise_name: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  rpe: number | null
}

export type Pose = 'front' | 'side' | 'back'

export interface ProgressPhoto {
  id: string
  client_id: string
  taken_on: string
  pose: Pose
  storage_path: string
  created_at: string
}
