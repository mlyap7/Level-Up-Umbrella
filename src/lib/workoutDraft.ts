// Saves an in-progress workout on the phone after every change, so it survives
// switching apps, the phone closing the app in the background, or bad gym signal.
// Nothing is sent to the database until the client taps Finish, so a workout is
// never saved twice.

export interface SetDraft { weight: string; reps: string; rpe: string; done: boolean }
export interface ExerciseDraft { name: string; target: string; notes: string; video?: string; sets: SetDraft[] }

export interface WorkoutDraft {
  workoutId: string          // program workout id, or "custom"
  workoutName: string
  date: string
  customName: string
  exercises: ExerciseDraft[]
  feeling: number | null
  remarks: string
  startedAt: number
  savedAt: number
}

const MAX_AGE_MS = 36 * 60 * 60 * 1000 // a forgotten draft expires after a day and a half
const key = (userId: string) => `levelup.workoutDraft.${userId}`

export function loadDraft(userId: string, now = Date.now()): WorkoutDraft | null {
  try {
    const d = JSON.parse(localStorage.getItem(key(userId)) ?? 'null') as WorkoutDraft | null
    if (!d || !Array.isArray(d.exercises) || now - d.savedAt > MAX_AGE_MS) return null
    // Drafts saved before the ✓ button existed have no `done` flag.
    d.exercises = d.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: Boolean(s.done) })) }))
    return d
  } catch {
    return null
  }
}

export function saveDraft(userId: string, draft: WorkoutDraft) {
  try {
    localStorage.setItem(key(userId), JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    // Storage full or blocked: the workout still works, it just won't survive a reload.
  }
}

export function clearDraft(userId: string) {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    // ignore
  }
}

export function draftSetCount(d: WorkoutDraft): number {
  return d.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done || s.weight || s.reps).length, 0)
}
