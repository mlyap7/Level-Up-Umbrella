import { useState, type FormEvent } from 'react'
import { listMeasurementTypes, renameMeasurementType, setMeasurementTypeArchived, updateProfile } from '../../lib/api'
import { useAuth, useProfile } from '../../lib/auth'
import type { GoalType, LengthUnit, WeightUnit } from '../../lib/types'
import { cmTo, parseNumber, round, toCm } from '../../lib/units'
import { useAsync } from '../../lib/useAsync'
import { Card, ErrorMsg, Loading, UnitInput } from '../../components/ui'
import { InstallSection } from '../../components/InstallCard'

export function ProfilePage() {
  const profile = useProfile()
  const { refreshProfile, session } = useAuth()
  const [name, setName] = useState(profile.full_name)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weight_unit)
  const [lengthUnit, setLengthUnit] = useState<LengthUnit>(profile.length_unit)
  const [goalType, setGoalType] = useState<GoalType>(profile.goal_type)
  const [goalNote, setGoalNote] = useState(profile.goal_note)
  const [height, setHeight] = useState(profile.height_cm != null ? String(round(cmTo(profile.height_cm, profile.length_unit))) : '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Keep the height field in the selected unit when the unit changes.
  function changeLengthUnit(next: LengthUnit) {
    const h = parseNumber(height)
    if (h != null && next !== lengthUnit) setHeight(String(round(cmTo(toCm(h, lengthUnit), next))))
    setLengthUnit(next)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const h = parseNumber(height)
    const hCm = h == null ? null : toCm(h, lengthUnit)
    if (hCm != null && (hCm < 90 || hCm > 250)) return setError(`Check your height (${lengthUnit}).`)
    setBusy(true)
    try {
      await updateProfile(profile.id, {
        full_name: name.trim(), weight_unit: weightUnit, length_unit: lengthUnit,
        goal_type: goalType, goal_note: goalNote.trim(), height_cm: hCm == null ? null : round(hCm, 1),
      })
      await refreshProfile()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>Profile</h1>
      <Card title="About you">
        <form className="stack" onSubmit={submit}>
          <label className="field">Full name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <div className="small muted">Signed in as {session?.user.email}</div>
          <div className="form-row">
            <label className="field">Weight unit
              <select value={weightUnit} onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}>
                <option value="kg">Kilograms (kg)</option>
                <option value="lb">Pounds (lb)</option>
              </select>
            </label>
            <label className="field">Measurement unit
              <select value={lengthUnit} onChange={(e) => changeLengthUnit(e.target.value as LengthUnit)}>
                <option value="cm">Centimetres (cm)</option>
                <option value="in">Inches (in)</option>
              </select>
            </label>
          </div>
          <label className="field">Height <span className="hint">Optional</span>
            <UnitInput unit={lengthUnit} value={height} onChange={(e) => setHeight(e.target.value)} />
          </label>
          {profile.role === 'client' && (
            <>
              <label className="field">Main goal
                <select value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
                  <option value="lose">Lose fat</option>
                  <option value="gain">Build muscle / gain weight</option>
                  <option value="maintain">Maintain and recomp</option>
                </select>
              </label>
              <label className="field">In your own words <span className="hint">What would make this coaching a success for you?</span>
                <textarea value={goalNote} onChange={(e) => setGoalNote(e.target.value)} rows={3} maxLength={1000} />
              </label>
            </>
          )}
          <ErrorMsg error={error} />
          {saved && <div className="alert alert-ok" role="status">Profile saved.</div>}
          <button className="btn" disabled={busy}>Save profile</button>
        </form>
      </Card>
      <InstallSection />
      {profile.role === 'client' && <MeasurementTypesCard clientId={profile.id} />}
    </div>
  )
}

function MeasurementTypesCard({ clientId }: { clientId: string }) {
  const { data, error, loading, reload } = useAsync(() => listMeasurementTypes(clientId), [clientId])
  if (loading && !data) return <Loading />
  return (
    <Card title="Tracked measurements">
      <p className="small muted">Hide a measurement to stop tracking it. Its history is kept and it comes back if you restore it. Add new ones from your Progress page.</p>
      <ErrorMsg error={error} />
      {(data ?? []).map((t) => (
        <div key={t.id} className="list-item row-between">
          <div className="row">
            <strong style={t.archived ? { color: 'var(--text-3)' } : undefined}>{t.name}</strong>
            {t.archived && <span className="badge">Hidden</span>}
          </div>
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={async () => {
              const next = prompt('Rename measurement', t.name)?.trim()
              if (next && next !== t.name) {
                try { await renameMeasurementType(t.id, next); reload() } catch { alert(`You already track a measurement called “${next}”.`) }
              }
            }}>Rename</button>
            <button className="btn btn-secondary btn-sm" onClick={async () => { await setMeasurementTypeArchived(t.id, !t.archived); reload() }}>
              {t.archived ? 'Restore' : 'Hide'}
            </button>
          </div>
        </div>
      ))}
    </Card>
  )
}
