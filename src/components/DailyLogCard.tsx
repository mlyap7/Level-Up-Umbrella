import { useEffect, useState, type FormEvent } from 'react'
import { upsertDailyLogs } from '../lib/api'
import { addDays, formatFullDate, todayISO } from '../lib/dates'
import { planMorningSave } from '../lib/morning'
import type { DailyLog, WeightUnit } from '../lib/types'
import { kgTo, parseNumber, round, toKg } from '../lib/units'
import { Card, ErrorMsg, UnitInput } from './ui'

const str = (v: number | null | undefined) => (v != null ? String(v) : '')

export function DailyLogCard({ clientId, logs, weightUnit, smartScale, onSaved }: {
  clientId: string
  logs: DailyLog[]
  weightUnit: WeightUnit
  smartScale: boolean
  onSaved: () => void
}) {
  const [date, setDate] = useState(todayISO())
  const today = logs.find((l) => l.log_date === date)
  const yesterday = logs.find((l) => l.log_date === addDays(date, -1))
  const [weight, setWeight] = useState('')
  const [sleep, setSleep] = useState('')
  const [steps, setSteps] = useState('')
  const [water, setWater] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [muscle, setMuscle] = useState('')
  const [visceral, setVisceral] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Prefill when this morning already has an entry, so saving updates it.
  useEffect(() => {
    setWeight(today?.weight_kg != null ? String(round(kgTo(today.weight_kg, weightUnit))) : '')
    setSleep(str(today?.sleep_hours))
    setBodyFat(str(today?.body_fat_pct))
    setMuscle(today?.muscle_mass_kg != null ? String(round(kgTo(today.muscle_mass_kg, weightUnit))) : '')
    setVisceral(str(today?.visceral_fat))
    setSteps(str(yesterday?.steps))
    setWater(str(yesterday?.water_l))
  }, [today?.id, yesterday?.id, date, weightUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear the "Saved" message only when they pick another day, not when their
  // own save creates that day's entry.
  useEffect(() => setSaved(false), [date])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const w = parseNumber(weight)
    const s = parseNumber(steps)
    const h = parseNumber(sleep)
    const l = parseNumber(water)
    const bf = parseNumber(bodyFat)
    const mm = parseNumber(muscle)
    const vf = parseNumber(visceral)
    if ([w, s, h, l, bf, mm, vf].every((v) => v == null)) return setError('Enter this morning’s numbers first.')
    const kg = w == null ? null : toKg(w, weightUnit)
    const mmKg = mm == null ? null : toKg(mm, weightUnit)
    if (kg != null && (kg < 25 || kg > 350)) return setError(`That weight looks off. Check it’s in ${weightUnit}.`)
    if (s != null && (s < 0 || s > 150000 || !Number.isInteger(s))) return setError('Steps should be a whole number.')
    if (h != null && (h < 0 || h > 24)) return setError('Sleep should be between 0 and 24 hours.')
    if (l != null && (l < 0 || l > 15)) return setError('Water should be in litres, e.g. 2.5.')
    if (bf != null && (bf < 2 || bf > 75)) return setError('Body fat should be a percentage, e.g. 28.4.')
    if (mmKg != null && (mmKg <= 5 || mmKg >= 200)) return setError(`Check your muscle mass (${weightUnit}).`)
    if (vf != null && (vf < 1 || vf > 60)) return setError('Visceral fat is the rating on your scale, usually 1 to 59.')
    setBusy(true)
    try {
      await upsertDailyLogs(clientId, planMorningSave({
        date,
        today: {
          weight_kg: kg == null ? null : round(kg, 2),
          sleep_hours: h,
          ...(smartScale ? { body_fat_pct: bf, muscle_mass_kg: mmKg == null ? null : round(mmKg, 2), visceral_fat: vf } : {}),
        },
        yesterday: { steps: s, water_l: l },
        logs,
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
        {smartScale && (
          <div className="form-row three">
            <label className="field">Body fat
              <UnitInput unit="%" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="e.g. 28.4" />
            </label>
            <label className="field">Muscle mass
              <UnitInput unit={weightUnit} value={muscle} onChange={(e) => setMuscle(e.target.value)} placeholder="e.g. 46.1" />
            </label>
            <label className="field">Visceral fat
              <input inputMode="decimal" value={visceral} onChange={(e) => setVisceral(e.target.value)} placeholder="e.g. 9" />
            </label>
          </div>
        )}
        <div className="form-row">
          <label className="field">Sleep last night <span className="hint">Hours</span>
            <UnitInput unit="h" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="e.g. 7.5" />
          </label>
          <label className="field">Water yesterday <span className="hint">Litres</span>
            <UnitInput unit="L" value={water} onChange={(e) => setWater(e.target.value)} placeholder="e.g. 2.5" />
          </label>
        </div>
        <label className="field">Steps yesterday <span className="hint">Total from your phone or watch</span>
          <input inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="e.g. 8500" />
        </label>
        <ErrorMsg error={error} />
        {saved && <div className="alert alert-ok" role="status">Saved for {isToday ? 'this morning' : `the morning of ${formatFullDate(date)}`}.</div>}
        <button className="btn btn-block" disabled={busy}>{today || yesterday?.steps != null || yesterday?.water_l != null ? 'Update check-in' : 'Save check-in'}</button>
      </form>
    </Card>
  )
}
