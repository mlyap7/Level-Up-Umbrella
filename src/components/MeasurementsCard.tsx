import { useEffect, useState, type FormEvent } from 'react'
import { addMeasurementType, upsertMeasurements } from '../lib/api'
import { formatDay, todayISO } from '../lib/dates'
import type { LengthUnit, Measurement, MeasurementType } from '../lib/types'
import { cmTo, parseNumber, round, toCm } from '../lib/units'
import { Card, ErrorMsg, UnitInput } from './ui'

export function MeasurementsCard({ clientId, types, measurements, lengthUnit, onSaved }: {
  clientId: string
  types: MeasurementType[]
  measurements: Measurement[]
  lengthUnit: LengthUnit
  onSaved: () => void
}) {
  const active = types.filter((t) => !t.archived)
  const [date, setDate] = useState(todayISO())
  const [values, setValues] = useState<Record<string, string>>({})
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const onDate = measurements.filter((m) => m.measured_on === date)
  useEffect(() => {
    setValues(Object.fromEntries(onDate.map((m) => [m.type_id, String(round(cmTo(m.value_cm, lengthUnit)))])))
    setSaved(false)
  }, [date, measurements.length, lengthUnit]) // eslint-disable-line react-hooks/exhaustive-deps

  const lastDate = measurements.length ? measurements[measurements.length - 1].measured_on : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const rows: { type_id: string; value_cm: number }[] = []
    for (const t of active) {
      const raw = values[t.id] ?? ''
      if (raw.trim() === '') continue
      const v = parseNumber(raw)
      const cm = v == null ? null : toCm(v, lengthUnit)
      if (cm == null || cm <= 5 || cm > 300) return setError(`Check your ${t.name.toLowerCase()} value (${lengthUnit}).`)
      rows.push({ type_id: t.id, value_cm: round(cm, 2) })
    }
    if (rows.length === 0) return setError('Enter at least one measurement.')
    setBusy(true)
    try {
      await upsertMeasurements(clientId, date, rows)
      setSaved(true)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  async function addType(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    if (types.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      return setError(`You already track “${name}”. Restore it from your profile if you hid it.`)
    }
    try {
      await addMeasurementType(clientId, name, types.length + 1)
      setNewName('')
      setAdding(false)
      setError(null)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add.')
    }
  }

  return (
    <Card title="Weekly measurements" action={lastDate ? <span className="small muted">Last: {formatDay(lastDate)}</span> : null}>
      <p className="small muted">Once a week, same day and time, tape snug but not tight.</p>
      <form className="stack" onSubmit={submit}>
        <label className="field">Date
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
        </label>
        <div className="form-row">
          {active.map((t) => (
            <label key={t.id} className="field">{t.name}
              <UnitInput unit={lengthUnit} value={values[t.id] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [t.id]: e.target.value }))} />
            </label>
          ))}
        </div>
        <ErrorMsg error={error} />
        {saved && <div className="alert alert-ok" role="status">Measurements saved.</div>}
        <button className="btn btn-block" disabled={busy || active.length === 0}>Save measurements</button>
      </form>
      <div style={{ marginTop: 12 }}>
        {adding ? (
          <form className="row" onSubmit={addType}>
            <input className="grow" style={{ width: 'auto' }} autoFocus placeholder="e.g. Right arm, Thigh, Chest" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} aria-label="New measurement name" />
            <button className="btn btn-secondary btn-sm">Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </form>
        ) : (
          <button className="link-btn small" onClick={() => setAdding(true)}>+ Track another measurement</button>
        )}
      </div>
    </Card>
  )
}
