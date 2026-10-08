import { useEffect, useState, type FormEvent } from 'react'
import { upsertDailyLogs } from '../lib/api'
import { addDays, formatFullDate, todayISO } from '../lib/dates'
import { planMorningSave } from '../lib/morning'
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
  const today = logs.find((l) => l.log_date === date)
  const yesterday = logs.find((l) => l.log_date === addDays(date, -1))
  const [weight, setWeight] = useState('')
  const [steps, setSteps] = useState('')
  const [sleep, setSleep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Prefill when this morning already has an entry, so saving updates it.
  useEffect(() => {
    setWeight(today?.weight_kg != null ? String(round(kgTo(today.weight_kg, weightUnit))) : '')
    setSleep(today?.sleep_hours != null ? String(today.sleep_hours) : '')
    setSteps(yesterday?.steps != null ? String(yesterday.steps) : '')
    setSaved(false)
  }, [today?.id, yesterday?.id, date, weightUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const w = parseNumber(weight)
    const s = parseNumber(steps)
    const h = parseNumber(sleep)
    if (w == null && s == null && h == null) return setError('Enter your weight, sleep and steps.')
    const kg = w == null ? null : toKg(w, weightUnit)
    if (kg != null && (kg < 25 || kg > 350)) return setError(`That weight looks off. Check it’s in ${weightUnit}.`)
    if (s != null && (s < 0 || s > 150000 || !Number.isInteger(s))) return setError('Steps should be a whole number.')
    if (h != null && (h < 0 || h > 24)) return setError('Sleep should be between 0 and 24 hours.')
    setBusy(true)
    try {
      await upsertDailyLogs(clientId, planMorningSave({
        date, weightKg: kg == null ? null : round(kg, 2), sleepHours: h, steps: s, logs,
      }))
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const isToday = date === todayISO()
  const logged = today?.weight_kg != null
  return (
    <Card title="Morning check-in" action={logged ? <span className="badge badge-brand">Logged</span> : null}>
      <form className="stack" onSubmit={submit}>
        <label className="field">Morning of
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
        </label>
        <label className="field">Body weight <span className="hint">This morning, after the toilet, before food or drink</span>
          <UnitInput unit={weightUnit} value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={weightUnit === 'kg' ? 'e.g. 72.4' : 'e.g. 159.6'} />
        </label>
        <div className="form-row">
          <label className="field">Sleep last night <span className="hint">Hours</span>
            <UnitInput unit="h" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="e.g. 7.5" />
          </label>
          <label className="field">Steps yesterday <span className="hint">Total from your phone or watch</span>
            <input inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="e.g. 8500" />
          </label>
        </div>
        <ErrorMsg error={error} />
        {saved && <div className="alert alert-ok" role="status">Saved for {isToday ? 'this morning' : `the morning of ${formatFullDate(date)}`}.</div>}
        <button className="btn btn-block" disabled={busy}>{today || yesterday?.steps != null ? 'Update check-in' : 'Save check-in'}</button>
      </form>
    </Card>
  )
}
