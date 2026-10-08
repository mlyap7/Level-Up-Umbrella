import { describe, expect, it } from 'vitest'
import { planMorningSave } from './morning'

describe('planMorningSave', () => {
  it('files weight and sleep under today, steps under yesterday', () => {
    expect(planMorningSave({ date: '2026-10-08', weightKg: 70, sleepHours: 7, steps: 9000, logs: [] })).toEqual([
      { log_date: '2026-10-08', weight_kg: 70, sleep_hours: 7 },
      { log_date: '2026-10-07', steps: 9000 },
    ])
  })
  it('crosses month boundaries', () => {
    const plan = planMorningSave({ date: '2026-11-01', weightKg: null, sleepHours: null, steps: 5000, logs: [] })
    expect(plan).toEqual([{ log_date: '2026-10-31', steps: 5000 }])
  })
  it('does not create empty rows', () => {
    expect(planMorningSave({ date: '2026-10-08', weightKg: 70, sleepHours: null, steps: null, logs: [] })).toEqual([
      { log_date: '2026-10-08', weight_kg: 70, sleep_hours: null },
    ])
  })
  it('clears steps that were removed', () => {
    const logs = [{ log_date: '2026-10-07', weight_kg: null, sleep_hours: null, steps: 8000 }]
    expect(planMorningSave({ date: '2026-10-08', weightKg: 70, sleepHours: null, steps: null, logs })).toContainEqual({ log_date: '2026-10-07', steps: null })
  })
})
