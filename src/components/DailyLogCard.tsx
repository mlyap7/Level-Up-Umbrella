import { useEffect, useState, type FormEvent } from 'react'
import { upsertDailyLog } from '../lib/api'
import { formatFullDate, todayISO } from '../lib/dates'
import type { DailyLog, WeightUnit } from '../lib/types'
import { kgTo, parseNumber, round, toKg } from '../lib/units'
import { Card, ErrorMsg, UnitInput } from './ui'

export function DailyLogCard({ clientId, logs, weightUnit, onSaved }: {
  clientId: string
  logs: DailyLog[]
  weightUnit: WeightUnit
  onSaved: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const existing = logs.find((l) => l.log_date === date)
  const [weight, setWeight] = useState('')
  const [steps, setSteps] = useState('')
  const [sleep, setSleep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Prefill when the chosen day already has an entry, so saving updates it.
  useEffect(() => {
    setWeight(existing?.weight_kg != null ? String(round(kgTo(existing.weight_kg, weightUnit))) : '')
    setSteps(existing?.steps != null ? String(existing.steps) : '')
    setSleep(existing?.sleep_hours != null ? String(existing.sleep_hours) : '')
    setSaved(false)
  }, [existing?.id, date, weightUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const w = parseNumber(weight)
    const s = parseNumber(steps)
    const h = parseNumber(sleep)
    if (w == null && s == null && h == null) return setError('Enter at least your weight.')
    const kg = w == null ? null : toKg(w, weightUnit)
    if (kg != null && (kg < 25 || kg > 350)) return setError(`That weight looks off. Check it’s in ${weightUnit}.`)
    if (s != null && (s < 0 || s > 150000 || !Number.isInteger(s))) return setError('Steps should be a whole number.')
    if (h != null && (h < 0 || h > 24)) return setError('Sleep should be between 0 and 24 hours.')
    setBusy(true)
    try {
      await upsertDailyLog(clientId, { log_date: date, weight_kg: kg == null ? null : round(kg, 2), steps: s, sleep_hours: h })
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const isToday = date === todayISO()
  return (
    <Card title="Daily check-in" action={existing ? <span className="badge badge-brand">Logged</span> : null}>
      <form className="stack" onSubmit={submit}>
        <label className="field">Date
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
        </label>
        <label className="field">Body weight <span className="hint">Morning, after the toilet, before food or drink</span>
          <UnitInput unit={weightUnit} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={weightUnit === 'kg' ? 'e.g. 72.4' : 'e.g. 159.6'} />
        </label>
        <div className="form-row">
          <label className="field">Steps <span className="hint">Optional</span>
            <input inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} />
          </label>
          <label className="field">Sleep <span className="hint">Optional</span>
            <UnitInput unit="h" value={sleep} onChange={(e) => setSleep(e.target.value)} />
          </label>
        </div>
        <ErrorMsg error={error} />
        {saved && <div className="alert alert-ok" role="status">Saved for {isToday ? 'today' : formatFullDate(date)}.</div>}
        <button className="btn btn-block" disabled={busy}>{existing ? 'Update entry' : 'Save'}</button>
      </form>
    </Card>
  )
}
