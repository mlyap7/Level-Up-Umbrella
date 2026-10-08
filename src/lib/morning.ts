// The daily check-in is done once, in the morning, about what just happened:
//   weight  → this morning        → filed under the chosen date
//   sleep   → last night          → filed under the chosen date (the wake-up day,
//                                    same convention as Apple Health, Garmin, Fitbit)
//   steps   → yesterday's total   → filed under the day BEFORE the chosen date
import { addDays } from './dates'
import type { DailyLog } from './types'

type Upsert = { log_date: string } & Partial<Pick<DailyLog, 'weight_kg' | 'sleep_hours' | 'steps'>>

export function planMorningSave(opts: {
  date: string
  weightKg: number | null
  sleepHours: number | null
  steps: number | null
  logs: Pick<DailyLog, 'log_date' | 'weight_kg' | 'sleep_hours' | 'steps'>[]
}): Upsert[] {
  const { date, weightKg, sleepHours, steps, logs } = opts
  const yesterday = addDays(date, -1)
  const today = logs.find((l) => l.log_date === date)
  const prev = logs.find((l) => l.log_date === yesterday)
  const out: Upsert[] = []

  // Only touch a day when there's something to write, or something to clear,
  // so we never create empty rows.
  const todayChanged = weightKg != null || sleepHours != null || today?.weight_kg != null || today?.sleep_hours != null
  if (todayChanged) out.push({ log_date: date, weight_kg: weightKg, sleep_hours: sleepHours })
  if (steps != null || prev?.steps != null) out.push({ log_date: yesterday, steps })
  return out
}
