import { addDays, daysBetween, weekStart } from './dates'
import type { CheckIn, CheckInComment, DailyLog, GoalType } from './types'

export interface Point {
  date: string
  value: number
}

export interface TrendPoint extends Point {
  avg: number
}

/**
 * Trailing rolling average over calendar days: for each logged day, the mean of
 * every value logged in the `windowDays` days ending that day. Missing days are
 * simply skipped, so a client who weighs in 4 times a week still gets a trend.
 */
export function rollingAverage(points: Point[], windowDays = 7): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  const out: TrendPoint[] = []
  let start = 0
  let sum = 0
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].value
    while (daysBetween(sorted[start].date, sorted[i].date) >= windowDays) {
      sum -= sorted[start].value
      start++
    }
    out.push({ ...sorted[i], avg: sum / (i - start + 1) })
  }
  return out
}

/** The latest trend value on or before `date`, or null. */
export function trendAt(trend: TrendPoint[], date: string): number | null {
  let found: number | null = null
  for (const p of trend) {
    if (p.date <= date) found = p.avg
    else break
  }
  return found
}

export interface WeightSummary {
  latest: number | null
  latestDate: string | null
  currentAvg: number | null
  weekChange: number | null
  totalChange: number | null
}

export function weightSummary(logs: Pick<DailyLog, 'log_date' | 'weight_kg'>[]): WeightSummary {
  const pts = logs
    .filter((l) => l.weight_kg != null)
    .map((l) => ({ date: l.log_date, value: Number(l.weight_kg) }))
  const trend = rollingAverage(pts)
  if (trend.length === 0) {
    return { latest: null, latestDate: null, currentAvg: null, weekChange: null, totalChange: null }
  }
  const last = trend[trend.length - 1]
  const weekAgo = trendAt(trend, addDays(last.date, -7))
  return {
    latest: last.value,
    latestDate: last.date,
    currentAvg: last.avg,
    weekChange: weekAgo == null ? null : last.avg - weekAgo,
    totalChange: trend.length > 1 ? last.avg - trend[0].value : null,
  }
}

// ---------------------------------------------------------------------------
// Coach "needs attention" flags
// ---------------------------------------------------------------------------

export type FlagLevel = 'critical' | 'warning'

export interface Flag {
  level: FlagLevel
  label: string
}

export interface FlagInput {
  goalType: GoalType
  joinedOn: string
  logs: Pick<DailyLog, 'log_date' | 'weight_kg'>[]
  checkIns: CheckIn[]
  comments: Pick<CheckInComment, 'check_in_id' | 'author_id' | 'created_at'>[]
  clientId: string
  today: string
}

export const RATING_THRESHOLDS = {
  adherence: { low: 5 },
  energy: { low: 4 },
  sleep_quality: { low: 4 },
  digestion: { low: 4 },
  hunger: { high: 8 },
  stress: { high: 8 },
} as const

const RATING_LABELS: Record<keyof typeof RATING_THRESHOLDS, string> = {
  adherence: 'Low adherence',
  energy: 'Low energy',
  sleep_quality: 'Poor sleep',
  digestion: 'Poor digestion',
  hunger: 'High hunger',
  stress: 'High stress',
}

export function clientFlags(input: FlagInput): Flag[] {
  const { goalType, joinedOn, logs, checkIns, comments, clientId, today } = input
  const flags: Flag[] = []

  // Logging consistency
  const weighIns = logs.filter((l) => l.weight_kg != null).map((l) => l.log_date).sort()
  const lastWeighIn = weighIns[weighIns.length - 1]
  if (!lastWeighIn) {
    if (daysBetween(joinedOn, today) >= 2) flags.push({ level: 'warning', label: 'No weigh-ins yet' })
  } else {
    const gap = daysBetween(lastWeighIn, today)
    if (gap >= 7) flags.push({ level: 'critical', label: `No weigh-in for ${gap} days` })
    else if (gap >= 3) flags.push({ level: 'warning', label: `No weigh-in for ${gap} days` })
  }

  // Trend vs goal over the last 14 days. Needs a few weigh-ins in each week
  // being compared, otherwise the averages are too noisy to judge.
  const recent = logs.filter((l) => l.weight_kg != null && daysBetween(l.log_date, today) <= 20)
  const thisWeek = recent.filter((l) => daysBetween(l.log_date, today) < 7)
  const twoWeeksAgo = recent.filter((l) => {
    const d = daysBetween(l.log_date, today)
    return d >= 14 && d < 21
  })
  if (thisWeek.length >= 3 && twoWeeksAgo.length >= 3) {
    const mean = (xs: typeof recent) => xs.reduce((s, l) => s + Number(l.weight_kg), 0) / xs.length
    const change = mean(thisWeek) - mean(twoWeeksAgo)
    if (goalType === 'lose' && change > -0.2) flags.push({ level: 'warning', label: 'Weight not trending down (2 wks)' })
    if (goalType === 'gain' && change < 0.2) flags.push({ level: 'warning', label: 'Weight not trending up (2 wks)' })
    if (goalType === 'maintain' && Math.abs(change) > 1.5)
      flags.push({ level: 'warning', label: `Weight moved ${change > 0 ? '+' : ''}${change.toFixed(1)} kg (2 wks)` })
  }

  // Weekly check-ins
  const sorted = [...checkIns].sort((a, b) => b.week_start.localeCompare(a.week_start))
  const latest = sorted[0]
  const thisMonday = weekStart(today)
  if (!latest) {
    if (daysBetween(joinedOn, today) >= 8) flags.push({ level: 'warning', label: 'No check-ins yet' })
  } else {
    if (daysBetween(latest.week_start, thisMonday) >= 14) {
      flags.push({ level: 'warning', label: 'Missed last week’s check-in' })
    }
    const coachReplied = comments.some(
      (c) => c.check_in_id === latest.id && c.author_id !== clientId && c.created_at >= latest.created_at,
    )
    if (!coachReplied) flags.push({ level: 'critical', label: 'Check-in awaiting your reply' })

    for (const [key, t] of Object.entries(RATING_THRESHOLDS) as [keyof typeof RATING_THRESHOLDS, { low?: number; high?: number }][]) {
      const v = latest[key]
      if ((t.low != null && v <= t.low) || (t.high != null && v >= t.high)) {
        flags.push({ level: 'warning', label: `${RATING_LABELS[key]} (${v}/10)` })
      }
    }
  }

  return flags
}

/** Critical first, then by count. Used to sort the coach's client list. */
export function attentionScore(flags: Flag[]): number {
  return flags.reduce((s, f) => s + (f.level === 'critical' ? 10 : 1), 0)
}
