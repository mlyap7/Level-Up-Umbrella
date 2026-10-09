// The daily check-in is done once, in the morning, about what just happened:
//   weight + smart-scale stats → this morning → filed under the chosen date
//   sleep  → last night        → filed under the chosen date (the wake-up day,
//                                 same convention as Apple Health, Garmin, Fitbit)
//   steps, water → yesterday   → filed under the day BEFORE the chosen date
import { addDays } from './dates'
import type { DailyLog } from './types'

type TodayKey = 'weight_kg' | 'sleep_hours' | 'body_fat_pct' | 'muscle_mass_kg' | 'visceral_fat'
type YesterdayKey = 'steps' | 'water_l'
type Upsert = { log_date: string } & Partial<Pick<DailyLog, TodayKey | YesterdayKey>>
type Values<K extends string> = Partial<Record<K, number | null>>

/**
 * Turns one morning's form into per-day saves. Only the fields passed in are
 * written (so hiding the smart-scale fields never clears old readings), and a
 * day is only touched when there's something to write or clear, so we never
 * create empty rows.
 */
export function planMorningSave(opts: {
  date: string
  today: Values<TodayKey>
  yesterday: Values<YesterdayKey>
  logs: Partial<DailyLog>[]
}): Upsert[] {
  const { date, logs } = opts
  const yDate = addDays(date, -1)
  const out: Upsert[] = []
  for (const [d, values] of [[date, opts.today], [yDate, opts.yesterday]] as const) {
    const existing = logs.find((l) => l.log_date === d) as Record<string, unknown> | undefined
    const keys = Object.keys(values) as (keyof typeof values)[]
    const changed = keys.some((k) => values[k] != null || existing?.[k] != null)
    if (changed) out.push({ log_date: d, ...values })
  }
  return out
}
