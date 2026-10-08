import { describe, expect, it } from 'vitest'
import { clientFlags, rollingAverage, weightSummary } from './stats'
import { addDays, weekStart } from './dates'
import { formatWeight, parseNumber, toKg } from './units'
import type { CheckIn } from './types'

const TODAY = '2026-09-30' // a Wednesday

function logsFrom(start: string, values: (number | null)[]) {
  return values.map((v, i) => ({ log_date: addDays(start, i), weight_kg: v }))
}

function checkIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: 'c1', client_id: 'u1', week_start: '2026-09-21',
    adherence: 8, energy: 7, hunger: 5, sleep_quality: 7, stress: 4, digestion: 7,
    wins: '', struggles: '', questions: '', created_at: '2026-09-27T10:00:00Z',
    ...overrides,
  }
}

describe('rollingAverage', () => {
  it('averages the trailing 7 calendar days and skips gaps', () => {
    const t = rollingAverage([
      { date: '2026-09-01', value: 80 },
      { date: '2026-09-02', value: 82 },
      { date: '2026-09-08', value: 78 }, // 09-01 drops out of the window, 09-02 stays
    ])
    expect(t.map((p) => p.avg)).toEqual([80, 81, 80])
  })

  it('sorts unsorted input', () => {
    const t = rollingAverage([{ date: '2026-09-02', value: 2 }, { date: '2026-09-01', value: 4 }])
    expect(t[0].date).toBe('2026-09-01')
    expect(t[1].avg).toBe(3)
  })
})

describe('weightSummary', () => {
  it('reports week-over-week change of the 7-day average', () => {
    const logs = logsFrom('2026-09-01', [80, 80, 80, 80, 80, 80, 80, 79, 79, 79, 79, 79, 79, 79])
    const s = weightSummary(logs)
    expect(s.currentAvg).toBeCloseTo(79)
    expect(s.weekChange).toBeCloseTo(-1)
    expect(s.latestDate).toBe('2026-09-14')
  })

  it('handles no data', () => {
    expect(weightSummary([]).currentAvg).toBeNull()
  })
})

describe('clientFlags', () => {
  const base = { goalType: 'lose' as const, joinedOn: '2026-08-01', clientId: 'u1', today: TODAY, comments: [] }

  it('flags missing weigh-ins by severity', () => {
    const warn = clientFlags({ ...base, logs: [{ log_date: addDays(TODAY, -4), weight_kg: 80 }], checkIns: [] })
    expect(warn.find((f) => f.label.startsWith('No weigh-in'))?.level).toBe('warning')
    const crit = clientFlags({ ...base, logs: [{ log_date: addDays(TODAY, -9), weight_kg: 80 }], checkIns: [] })
    expect(crit.find((f) => f.label.startsWith('No weigh-in'))?.level).toBe('critical')
  })

  it('flags a stalled cut but not a working one', () => {
    const stalled = logsFrom(addDays(TODAY, -20), Array(21).fill(80))
    expect(clientFlags({ ...base, logs: stalled, checkIns: [] }).map((f) => f.label)).toContain(
      'Weight not trending down (2 wks)',
    )
    const working = logsFrom(addDays(TODAY, -20), Array.from({ length: 21 }, (_, i) => 80 - i * 0.1))
    expect(clientFlags({ ...base, logs: working, checkIns: [] }).map((f) => f.label)).not.toContain(
      'Weight not trending down (2 wks)',
    )
  })

  it('flags an unanswered check-in and clears it once the coach replies', () => {
    const logs = [{ log_date: TODAY, weight_kg: 80 }]
    const ci = checkIn()
    expect(clientFlags({ ...base, logs, checkIns: [ci] }).map((f) => f.label)).toContain('Check-in awaiting your reply')
    const replied = clientFlags({
      ...base, logs, checkIns: [ci],
      comments: [{ check_in_id: 'c1', author_id: 'coach', created_at: '2026-09-28T09:00:00Z' }],
    })
    expect(replied.map((f) => f.label)).not.toContain('Check-in awaiting your reply')
  })

  it('does not count the client’s own comment as a reply', () => {
    const flags = clientFlags({
      ...base, logs: [{ log_date: TODAY, weight_kg: 80 }], checkIns: [checkIn()],
      comments: [{ check_in_id: 'c1', author_id: 'u1', created_at: '2026-09-28T09:00:00Z' }],
    })
    expect(flags.map((f) => f.label)).toContain('Check-in awaiting your reply')
  })

  it('flags worrying ratings in the direction that matters', () => {
    const flags = clientFlags({
      ...base, logs: [{ log_date: TODAY, weight_kg: 80 }],
      checkIns: [checkIn({ adherence: 4, stress: 9, hunger: 2 })],
    }).map((f) => f.label)
    expect(flags).toContain('Low adherence (4/10)')
    expect(flags).toContain('High stress (9/10)')
    expect(flags.some((l) => l.startsWith('High hunger'))).toBe(false)
  })

  it('flags a missed weekly check-in', () => {
    const flags = clientFlags({
      ...base, logs: [{ log_date: TODAY, weight_kg: 80 }],
      checkIns: [checkIn({ week_start: '2026-09-14' })],
    })
    expect(flags.map((f) => f.label)).toContain('Missed last week’s check-in')
  })
})

describe('dates and units', () => {
  it('finds the Monday of a week', () => {
    expect(weekStart('2026-09-30')).toBe('2026-09-28')
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sunday
    expect(weekStart('2026-09-28')).toBe('2026-09-28')
  })

  it('adds days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('converts and formats units', () => {
    expect(toKg(176.37, 'lb')).toBeCloseTo(80, 1)
    expect(formatWeight(80, 'lb')).toBe('176.4 lb')
    expect(parseNumber('72,5')).toBe(72.5)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('abc')).toBeNull()
  })
})

import { formatChange } from './units'
describe('formatChange', () => {
  it('never shows negative zero', () => {
    expect(formatChange(-0.04, 'kg')).toBe('±0.0 kg')
    expect(formatChange(-1.26, 'kg')).toBe('−1.3 kg')
    expect(formatChange(0.5, '')).toBe('+0.5')
  })
})

import { isPhotoWeek, photosDue } from './photos'
describe('photo weeks', () => {
  it('alternates weeks from the start week', () => {
    expect(isPhotoWeek('2026-09-02', '2026-09-03')).toBe(true)   // same week
    expect(isPhotoWeek('2026-09-02', '2026-09-09')).toBe(false)  // next week
    expect(isPhotoWeek('2026-09-02', '2026-09-16')).toBe(true)   // two weeks later
  })
  it('is not due if photos were uploaded recently', () => {
    expect(photosDue('2026-09-02', '2026-09-16', [{ taken_on: '2026-09-14' }])).toBe(false)
    expect(photosDue('2026-09-02', '2026-09-16', [{ taken_on: '2026-09-01' }])).toBe(true)
  })
})
