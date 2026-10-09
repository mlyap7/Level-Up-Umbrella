import { describe, expect, it } from 'vitest'
import { planMorningSave } from './morning'

describe('planMorningSave', () => {
  it('files weight and sleep under today, steps and water under yesterday', () => {
    expect(planMorningSave({ date: '2026-10-08', today: { weight_kg: 70, sleep_hours: 7 }, yesterday: { steps: 9000, water_l: 2.5 }, logs: [] })).toEqual([
      { log_date: '2026-10-08', weight_kg: 70, sleep_hours: 7 },
      { log_date: '2026-10-07', steps: 9000, water_l: 2.5 },
    ])
  })
  it('crosses month boundaries', () => {
    const plan = planMorningSave({ date: '2026-11-01', today: { weight_kg: null }, yesterday: { steps: 5000 }, logs: [] })
    expect(plan).toEqual([{ log_date: '2026-10-31', steps: 5000 }])
  })
  it('does not create empty rows', () => {
    expect(planMorningSave({ date: '2026-10-08', today: { weight_kg: 70, sleep_hours: null }, yesterday: { steps: null, water_l: null }, logs: [] })).toEqual([
      { log_date: '2026-10-08', weight_kg: 70, sleep_hours: null },
    ])
  })
  it('clears values that were removed', () => {
    const logs = [{ log_date: '2026-10-07', steps: 8000 }]
    expect(planMorningSave({ date: '2026-10-08', today: { weight_kg: 70 }, yesterday: { steps: null }, logs })).toContainEqual({ log_date: '2026-10-07', steps: null })
  })
  it('includes smart-scale readings only when given', () => {
    const plan = planMorningSave({ date: '2026-10-08', today: { weight_kg: 70, body_fat_pct: 28.4, muscle_mass_kg: 46.1, visceral_fat: 9 }, yesterday: {}, logs: [] })
    expect(plan).toEqual([{ log_date: '2026-10-08', weight_kg: 70, body_fat_pct: 28.4, muscle_mass_kg: 46.1, visceral_fat: 9 }])
    const noScale = planMorningSave({ date: '2026-10-08', today: { weight_kg: 70 }, yesterday: {}, logs: [{ log_date: '2026-10-08', body_fat_pct: 30 }] })
    expect(noScale[0]).not.toHaveProperty('body_fat_pct')
  })
})
