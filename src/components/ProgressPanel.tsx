import { useMemo, useState } from 'react'
import { deleteDailyLog, deleteMeasurement } from '../lib/api'
import { addDays, formatFullDate, formatShortDate, todayISO } from '../lib/dates'
import { rollingAverage, weightSummary } from '../lib/stats'
import type { LengthUnit, WeightUnit } from '../lib/types'
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

interface Props {
  data: ProgressData
  weightUnit: WeightUnit
  lengthUnit: LengthUnit
  editable: boolean
  onChanged?: () => void
}


export function ProgressPanel({ data, weightUnit, lengthUnit, editable, onChanged }: Props) {
  const types = data.types.filter((t) => !t.archived)
  const [metric, setMetric] = useState<string>('weight')
  const [range, setRange] = useState<RangeKey>('3m')
  const [showAll, setShowAll] = useState(false)

  const activeType = types.find((t) => t.id === metric)
  const isWeight = metric === 'weight' || !activeType
  const unit = isWeight ? weightUnit : lengthUnit
  const since = (() => {
    const r = RANGES.find((x) => x.key === range)!
    return r.days == null ? null : addDays(todayISO(), -r.days)
  })()

  const allPoints = useMemo(() => {
    if (isWeight) {
      return data.logs
        .filter((l) => l.weight_kg != null)
        .map((l) => ({ date: l.log_date, value: kgTo(l.weight_kg!, weightUnit), id: l.id }))
    }
    return data.measurements
      .filter((m) => m.type_id === activeType!.id)
      .map((m) => ({ date: m.measured_on, value: cmTo(m.value_cm, lengthUnit), id: m.id }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [isWeight, activeType, data, weightUnit, lengthUnit])

  // Compute the trend on all data so the first days of a range still have a
  // proper 7-day average, then cut to the range.
  const points = since ? allPoints.filter((p) => p.date >= since) : allPoints

  const summary = useMemo(() => {
    if (isWeight) {
      const s = weightSummary(data.logs)
      return [
        { label: '7-day average', value: s.currentAvg == null ? '–' : `${kgTo(s.currentAvg, weightUnit).toFixed(1)} ${weightUnit}` },
        { label: 'vs last week', value: formatChange(s.weekChange == null ? null : kgTo(s.weekChange, weightUnit), weightUnit) },
        { label: 'Since start', value: formatChange(s.totalChange == null ? null : kgTo(s.totalChange, weightUnit), weightUnit) },
      ]
    }
    const latest = allPoints[allPoints.length - 1]
    const prev = allPoints[allPoints.length - 2]
    const first = allPoints[0]
    return [
      { label: 'Latest', value: latest ? `${latest.value.toFixed(1)} ${lengthUnit}` : '–' },
      { label: 'vs previous', value: latest && prev ? formatChange(latest.value - prev.value, lengthUnit) : '–' },
      { label: 'Since start', value: latest && first && allPoints.length > 1 ? formatChange(latest.value - first.value, lengthUnit) : '–' },
    ]
  }, [isWeight, data.logs, allPoints, weightUnit, lengthUnit])

  const trendByDate = useMemo(
    () => (isWeight ? new Map(rollingAverage(allPoints).map((p) => [p.date, p.avg])) : new Map<string, number>()),
    [isWeight, allPoints],
  )
  const logsByDate = useMemo(() => new Map(data.logs.map((l) => [l.log_date, l])), [data.logs])
  const history = [...allPoints].reverse()
  const visibleHistory = showAll ? history : history.slice(0, 10)

  async function remove(id: string) {
    if (!confirm('Delete this entry?')) return
    if (isWeight) await deleteDailyLog(id)
    else await deleteMeasurement(id)
    onChanged?.()
  }

  const label = isWeight ? 'Weight' : activeType!.name

  return (
    <div className="stack">
      <Card>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div className="segmented" role="group" aria-label="Metric">
            <button type="button" aria-pressed={isWeight} onClick={() => setMetric('weight')}>Weight</button>
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
        <ProgressChart points={points} unit={unit} label={isWeight ? 'Weigh-in' : label} showTrend={isWeight} />
        {isWeight && points.length > 0 && (
          <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Daily weight moves up and down with water, salt, carbs and your cycle. Judge progress by the orange line, not single days.
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
                    {isWeight && <th>7-day avg</th>}
                    {isWeight && <th>Steps</th>}
                    {isWeight && <th>Sleep</th>}
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
                        <td style={{ whiteSpace: 'nowrap' }}>{p.value.toFixed(1)} {unit}</td>
                        {isWeight && <td style={{ whiteSpace: 'nowrap' }}>{avg != null ? `${avg.toFixed(1)} ${unit}` : '–'}</td>}
                        {isWeight && <td>{log?.steps != null ? log.steps.toLocaleString() : '–'}</td>}
                        {isWeight && <td style={{ whiteSpace: 'nowrap' }}>{log?.sleep_hours != null ? `${log.sleep_hours} h` : '–'}</td>}
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
