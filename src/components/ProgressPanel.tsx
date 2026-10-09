import { useMemo, useState } from 'react'
import { clearDailyField, deleteMeasurement } from '../lib/api'
import { addDays, formatFullDate, formatShortDate, todayISO } from '../lib/dates'
import { rollingAverage, trendSummary } from '../lib/stats'
import type { DailyLog, LengthUnit, WeightUnit } from '../lib/types'
import { cmTo, formatChange, kgTo } from '../lib/units'
import type { ProgressData } from '../lib/useProgressData'
import { ProgressChart } from './ProgressChart'
import { Card } from './ui'

const RANGES = [
  { key: '4w', label: '4W', days: 28 },
  { key: '3m', label: '3M', days: 91 },
  { key: '6m', label: '6M', days: 182 },
  { key: 'all', label: 'All', days: null },
] as const

type RangeKey = (typeof RANGES)[number]['key']

/** Numbers logged every morning. All get a 7-day trend line. */
type DailyField = 'weight_kg' | 'body_fat_pct' | 'muscle_mass_kg' | 'visceral_fat'
interface DailyMetric { key: string; field: DailyField; label: string; pointLabel: string; kind: 'mass' | 'percent' | 'rating' }

const DAILY_METRICS: DailyMetric[] = [
  { key: 'weight', field: 'weight_kg', label: 'Weight', pointLabel: 'Weigh-in', kind: 'mass' },
  { key: 'body_fat', field: 'body_fat_pct', label: 'Body fat', pointLabel: 'Body fat', kind: 'percent' },
  { key: 'muscle', field: 'muscle_mass_kg', label: 'Muscle', pointLabel: 'Muscle mass', kind: 'mass' },
  { key: 'visceral', field: 'visceral_fat', label: 'Visceral fat', pointLabel: 'Visceral fat', kind: 'rating' },
]

const BODY_STAT_NOTE = 'Smart-scale readings swing with hydration. Compare with yourself on the same scale and judge by the orange trend line.'

interface Props {
  data: ProgressData
  weightUnit: WeightUnit
  lengthUnit: LengthUnit
  editable: boolean
  /** Show body fat / muscle / visceral tabs even before any readings exist. */
  showBodyStats?: boolean
  onChanged?: () => void
}

export function ProgressPanel({ data, weightUnit, lengthUnit, editable, showBodyStats = false, onChanged }: Props) {
  const types = data.types.filter((t) => !t.archived)
  const [metric, setMetric] = useState<string>('weight')
  const [range, setRange] = useState<RangeKey>('3m')
  const [showAll, setShowAll] = useState(false)

  const dailyMetrics = DAILY_METRICS.filter((m) =>
    m.key === 'weight' || showBodyStats || data.logs.some((l) => l[m.field] != null))
  const daily = dailyMetrics.find((m) => m.key === metric)
  const activeType = daily ? undefined : types.find((t) => t.id === metric)
  const current: DailyMetric = daily ?? (activeType ? DAILY_METRICS[0] : DAILY_METRICS[0])
  const isDaily = Boolean(daily) || !activeType
  const isWeight = isDaily && current.key === 'weight'

  const unit = !isDaily ? lengthUnit : current.kind === 'mass' ? weightUnit : current.kind === 'percent' ? '%' : ''
  const fmt = (v: number) => `${v.toFixed(1)}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`
  const since = (() => {
    const r = RANGES.find((x) => x.key === range)!
    return r.days == null ? null : addDays(todayISO(), -r.days)
  })()

  const allPoints = useMemo(() => {
    if (isDaily) {
      const f = current.field
      return data.logs
        .filter((l) => l[f] != null)
        .map((l) => ({ date: l.log_date, value: current.kind === 'mass' ? kgTo(Number(l[f]), weightUnit) : Number(l[f]), id: l.id }))
    }
    return data.measurements
      .filter((m) => m.type_id === activeType!.id)
      .map((m) => ({ date: m.measured_on, value: cmTo(m.value_cm, lengthUnit), id: m.id }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [isDaily, current, activeType, data, weightUnit, lengthUnit])

  // Compute the trend on all data so the first days of a range still have a
  // proper 7-day average, then cut to the range.
  const points = since ? allPoints.filter((p) => p.date >= since) : allPoints

  const summary = useMemo(() => {
    const changeUnit = unit === '%' ? 'pts' : unit
    if (isDaily) {
      const s = trendSummary(allPoints)
      return [
        { label: '7-day average', value: s.currentAvg == null ? '–' : fmt(s.currentAvg) },
        { label: 'vs last week', value: formatChange(s.weekChange, changeUnit) },
        { label: 'Since start', value: formatChange(s.totalChange, changeUnit) },
      ]
    }
    const latest = allPoints[allPoints.length - 1]
    const prev = allPoints[allPoints.length - 2]
    const first = allPoints[0]
    return [
      { label: 'Latest', value: latest ? fmt(latest.value) : '–' },
      { label: 'vs previous', value: latest && prev ? formatChange(latest.value - prev.value, lengthUnit) : '–' },
      { label: 'Since start', value: latest && first && allPoints.length > 1 ? formatChange(latest.value - first.value, lengthUnit) : '–' },
    ]
  }, [isDaily, allPoints, unit, lengthUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  const trendByDate = useMemo(
    () => (isDaily ? new Map(rollingAverage(allPoints).map((p) => [p.date, p.avg])) : new Map<string, number>()),
    [isDaily, allPoints],
  )
  const logsByDate = useMemo(() => new Map(data.logs.map((l) => [l.log_date, l])), [data.logs])
  const history = [...allPoints].reverse()
  const visibleHistory = showAll ? history : history.slice(0, 10)

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return
    // Clear just this number, keeping the rest of that day (sleep, steps, water…).
    if (isDaily) await clearDailyField(id, current.field)
    else await deleteMeasurement(id)
    onChanged?.()
  }

  const label = isDaily ? current.label : activeType!.name
  const cell = (log: DailyLog | undefined, f: 'steps' | 'sleep_hours' | 'water_l') => {
    const v = log?.[f]
    if (v == null) return '–'
    return f === 'steps' ? v.toLocaleString() : f === 'sleep_hours' ? `${v} h` : `${v} L`
  }

  return (
    <div className="stack">
      <Card>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div className="segmented" role="group" aria-label="Metric">
            {dailyMetrics.map((m) => (
              <button key={m.key} type="button" aria-pressed={isDaily && current.key === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>
            ))}
            {types.map((t) => (
              <button key={t.id} type="button" aria-pressed={metric === t.id} onClick={() => setMetric(t.id)}>{t.name}</button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button key={r.key} type="button" aria-pressed={range === r.key} onClick={() => setRange(r.key)}>{r.label}</button>
            ))}
          </div>
        </div>
        <div className="stats">
          {summary.map((s) => (
            <div key={s.label}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>
        <ProgressChart points={points} unit={unit} label={isDaily ? current.pointLabel : label} showTrend={isDaily} />
        {isDaily && points.length > 0 && (
          <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
            {isWeight
              ? 'Daily weight moves up and down with water, salt, carbs and your cycle. Judge progress by the orange line, not single days.'
              : BODY_STAT_NOTE}
          </p>
        )}
      </Card>

      <Card title={`${label} history`}>
        {history.length === 0 ? (
          <div className="empty">Nothing logged yet.</div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>{label}</th>
                    {isDaily && <th>7-day avg</th>}
                    {isWeight && <th>Steps</th>}
                    {isWeight && <th>Sleep</th>}
                    {isWeight && <th>Water</th>}
                    {editable && <th aria-label="Actions" />}
                  </tr>
                </thead>
                <tbody>
                  {visibleHistory.map((p) => {
                    const log = logsByDate.get(p.date)
                    const avg = trendByDate.get(p.date)
                    return (
                      <tr key={p.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{formatShortDate(p.date)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmt(p.value)}</td>
                        {isDaily && <td style={{ whiteSpace: 'nowrap' }}>{avg != null ? fmt(avg) : '–'}</td>}
                        {isWeight && <td>{cell(log, 'steps')}</td>}
                        {isWeight && <td style={{ whiteSpace: 'nowrap' }}>{cell(log, 'sleep_hours')}</td>}
                        {isWeight && <td style={{ whiteSpace: 'nowrap' }}>{cell(log, 'water_l')}</td>}
                        {editable && (
                          <td style={{ textAlign: 'right' }}>
                            <button className="icon-btn" aria-label={`Delete entry for ${formatFullDate(p.date)}`} onClick={() => void remove(p.id)}>×</button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {history.length > 10 && (
              <button className="link-btn small" style={{ marginTop: 8 }} onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Show less' : `Show all ${history.length} entries`}
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
