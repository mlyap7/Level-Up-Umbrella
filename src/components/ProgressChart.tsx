import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDay, formatFullDate, parseISODate } from '../lib/dates'
import { rollingAverage, type Point } from '../lib/stats'
import { useCssVars } from '../lib/useCssVars'

interface Props {
  points: Point[]       // already in display units
  unit: string
  label: string         // e.g. "Weigh-in", "Waist"
  showTrend: boolean    // 7-day average line (for daily data like weight)
}

interface Row { t: number; date: string; value: number; avg?: number }

export function ProgressChart({ points, unit, label, showTrend }: Props) {
  const c = useCssVars(['chart-line', 'chart-dot', 'chart-grid', 'text-3', 'surface'] as const)

  if (points.length === 0) {
    return <div className="empty">No entries yet. Log your first one and your progress chart appears here.</div>
  }

  const rows: Row[] = showTrend
    ? rollingAverage(points).map((p) => ({ t: parseISODate(p.date).getTime(), date: p.date, value: p.value, avg: p.avg }))
    : [...points].sort((a, b) => a.date.localeCompare(b.date)).map((p) => ({ t: parseISODate(p.date).getTime(), date: p.date, value: p.value }))

  const values = rows.flatMap((r) => (r.avg != null ? [r.value, r.avg] : [r.value]))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.15, 0.5)
  const domain: [number, number] = [Math.floor(min - pad), Math.ceil(max + pad)]
  const single = rows.length === 1
  const xDomain: [number, number] = single ? [rows[0].t - 3 * 86_400_000, rows[0].t + 3 * 86_400_000] : [rows[0].t, rows[rows.length - 1].t]

  return (
    <div>
      <div className="chart-box" role="img" aria-label={`${label} chart, ${rows.length} entries. See the table below for values.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={c['chart-grid']} />
            <XAxis
              dataKey="t" type="number" scale="time" domain={xDomain}
              tickFormatter={(t: number) => formatDay(isoFromTime(t))}
              tick={{ fill: c['text-3'], fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={32}
            />
            <YAxis
              domain={domain} tick={{ fill: c['text-3'], fontSize: 12 }} axisLine={false} tickLine={false}
              width={48} tickFormatter={(v: number) => String(Math.round(v * 10) / 10)} allowDecimals
            />
            <Tooltip
              cursor={{ stroke: c['text-3'], strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const r = payload[0].payload as Row
                return (
                  <div className="chart-tooltip">
                    <div style={{ fontWeight: 600 }}>{formatFullDate(r.date)}</div>
                    <div>{label}: {r.value.toFixed(1)} {unit}</div>
                    {r.avg != null && <div>7-day average: {r.avg.toFixed(1)} {unit}</div>}
                  </div>
                )
              }}
            />
            <Line
              dataKey="value" name={label} isAnimationActive={false}
              stroke={showTrend ? 'transparent' : c['chart-line']} strokeWidth={2}
              dot={{ r: 4, fill: showTrend ? c['chart-dot'] : c['chart-line'], stroke: c.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: showTrend ? c['chart-dot'] : c['chart-line'], stroke: c.surface, strokeWidth: 2 }}
            />
            {showTrend && (
              <Line
                dataKey="avg" name="7-day average" isAnimationActive={false}
                stroke={c['chart-line']} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: c['chart-line'], stroke: c.surface, strokeWidth: 2 }}
                strokeLinecap="round" strokeLinejoin="round"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {showTrend && (
        <div className="chart-legend">
          <span><i className="key-dot" /> Daily {label.toLowerCase()}</span>
          <span><i className="key-line" /> 7-day average (your real trend)</span>
        </div>
      )}
    </div>
  )
}

function isoFromTime(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
