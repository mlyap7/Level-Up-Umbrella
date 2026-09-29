import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createSession, listPrograms, listSessions, type FullSession } from '../../lib/api'
import { useProfile } from '../../lib/auth'
import { todayISO } from '../../lib/dates'
import { FEELINGS, formatSet, lastSetsFor } from '../../lib/training'
import { kgTo, parseNumber, round, toKg } from '../../lib/units'
import { useAsync } from '../../lib/useAsync'
import { Card, ErrorMsg, Loading, RatingScale } from '../../components/ui'

interface SetDraft { weight: string; reps: string; rpe: string }
interface ExerciseDraft { name: string; target: string; notes: string; sets: SetDraft[] }

const blankSet = (): SetDraft => ({ weight: '', reps: '', rpe: '' })

export function LogWorkout() {
  const { workoutId } = useParams()
  const profile = useProfile()
  const navigate = useNavigate()
  const unit = profile.weight_unit

  const { data, error, loading } = useAsync(async () => {
    const [programs, sessions] = await Promise.all([listPrograms(profile.id), listSessions(profile.id, 100)])
    const workout = programs.flatMap((p) => p.workouts).find((w) => w.id === workoutId) ?? null
    return { workout, sessions }
  }, [profile.id, workoutId])

  const [exercises, setExercises] = useState<ExerciseDraft[]>([])
  const [date, setDate] = useState(todayISO())
  const [feeling, setFeeling] = useState<number | null>(null)
  const [remarks, setRemarks] = useState('')
  const [customName, setCustomName] = useState('')
  const [newExercise, setNewExercise] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!data?.workout) return
    setExercises(data.workout.exercises.map((e) => ({
      name: e.name,
      target: [e.target_sets && `${e.target_sets} sets`, e.target_reps && `${e.target_reps} reps`, e.target_rpe && `RPE ${e.target_rpe}`].filter(Boolean).join(' · '),
      notes: e.notes,
      sets: Array.from({ length: e.target_sets ?? 3 }, blankSet),
    })))
  }, [data?.workout])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load workout.'} />
  if (workoutId !== 'custom' && !data.workout) {
    return <Card><div className="empty">That workout wasn’t found. <Link to="/training">Back to training</Link></div></Card>
  }

  const update = (i: number, fn: (e: ExerciseDraft) => ExerciseDraft) =>
    setExercises((xs) => xs.map((x, j) => (j === i ? fn(x) : x)))

  function addExercise(e: FormEvent) {
    e.preventDefault()
    if (!newExercise.trim()) return
    setExercises((xs) => [...xs, { name: newExercise.trim(), target: '', notes: '', sets: [blankSet(), blankSet(), blankSet()] }])
    setNewExercise('')
  }

  async function save() {
    setFormError(null)
    const sets = []
    for (const ex of exercises) {
      let n = 0
      for (const s of ex.sets) {
        const w = parseNumber(s.weight)
        const r = parseNumber(s.reps)
        const rpe = parseNumber(s.rpe)
        if (w == null && r == null) continue // untouched row
        if (r != null && (!Number.isInteger(r) || r < 0 || r > 999)) return setFormError(`${ex.name}: reps should be a whole number.`)
        if (w != null && (w < 0 || w > 2000)) return setFormError(`${ex.name}: check the weight.`)
        if (rpe != null && (rpe < 1 || rpe > 10)) return setFormError(`${ex.name}: RPE is 1 to 10.`)
        sets.push({
          exercise_name: ex.name, set_number: ++n,
          weight_kg: w == null ? null : round(toKg(w, unit), 2), reps: r, rpe,
        })
      }
    }
    if (sets.length === 0) return setFormError('Log at least one set.')
    setBusy(true)
    try {
      await createSession(profile.id, {
        workout_id: data!.workout?.id ?? null,
        workout_name: data!.workout?.name ?? (customName.trim() || 'Custom workout'),
        performed_on: date, feeling, remarks: remarks.trim(), sets,
      })
      navigate('/training')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.')
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div>
        <Link to="/training" className="small">← Training</Link>
        <h1 style={{ marginTop: 4 }}>{data.workout?.name ?? 'Custom workout'}</h1>
      </div>

      <Card>
        <div className="form-row">
          <label className="field">Date
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
          </label>
          {!data.workout && (
            <label className="field">Workout name
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Hotel gym" />
            </label>
          )}
        </div>
      </Card>

      <Card>
        {exercises.length === 0 && <div className="empty">Add your first exercise below.</div>}
        {exercises.map((ex, i) => (
          <ExerciseEditor key={i} ex={ex} unit={unit} sessions={data.sessions}
            onChange={(fn) => update(i, fn)}
            onRemove={() => setExercises((xs) => xs.filter((_, j) => j !== i))} />
        ))}
        <form className="row" onSubmit={addExercise} style={{ marginTop: 12 }}>
          <input className="grow" style={{ width: 'auto' }} placeholder="Add an exercise" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} aria-label="Exercise name" maxLength={80} />
          <button className="btn btn-secondary btn-sm">Add</button>
        </form>
      </Card>

      <Card title="How did it feel?">
        <div className="stack">
          <RatingScale label="How the session felt" value={feeling} onChange={setFeeling} max={5} low={FEELINGS[0]} high={FEELINGS[4]} />
          <label className="field">Remarks
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} placeholder="Energy, pain or niggles, technique notes, what to change next time…" />
          </label>
          <ErrorMsg error={formError} />
          <button className="btn" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Finish and save workout'}</button>
        </div>
      </Card>
    </div>
  )
}

function ExerciseEditor({ ex, unit, sessions, onChange, onRemove }: {
  ex: ExerciseDraft
  unit: 'kg' | 'lb'
  sessions: FullSession[]
  onChange: (fn: (e: ExerciseDraft) => ExerciseDraft) => void
  onRemove: () => void
}) {
  const last = lastSetsFor(sessions, ex.name)
  const setField = (j: number, field: keyof SetDraft, value: string) =>
    onChange((e) => ({ ...e, sets: e.sets.map((s, k) => (k === j ? { ...s, [field]: value } : s)) }))

  return (
    <div className="exercise-block">
      <div className="row-between">
        <div>
          <strong>{ex.name}</strong>
          {ex.target && <span className="badge badge-brand" style={{ marginLeft: 8 }}>{ex.target}</span>}
        </div>
        <button className="icon-btn" aria-label={`Remove ${ex.name}`} onClick={onRemove}>×</button>
      </div>
      {ex.notes && <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{ex.notes}</div>}
      <div className="prev">
        {last ? <>Last time: <span className="tabular">{last.sets.map((s) => formatSet(s, unit)).join(', ')}</span></> : 'First time logging this exercise'}
      </div>
      <div className="set-grid" style={{ marginTop: 8 }}>
        <span className="head">Set</span><span className="head">Weight ({unit})</span><span className="head">Reps</span><span className="head">RPE</span><span />
        {ex.sets.map((s, j) => {
          const prev = last?.sets[j]
          return (
            <FragmentRow key={j} n={j + 1}
              weight={s.weight} reps={s.reps} rpe={s.rpe}
              phWeight={prev?.weight_kg != null ? String(round(kgTo(prev.weight_kg, unit))) : ''}
              phReps={prev?.reps != null ? String(prev.reps) : ''}
              onField={(f, v) => setField(j, f, v)}
              onRemove={() => onChange((e) => ({ ...e, sets: e.sets.filter((_, k) => k !== j) }))} />
          )
        })}
      </div>
      <button className="link-btn small" style={{ marginTop: 6 }}
        onClick={() => onChange((e) => ({ ...e, sets: [...e.sets, { ...blankSet(), weight: e.sets[e.sets.length - 1]?.weight ?? '' }] }))}>
        + Add set
      </button>
    </div>
  )
}

function FragmentRow({ n, weight, reps, rpe, phWeight, phReps, onField, onRemove }: {
  n: number; weight: string; reps: string; rpe: string; phWeight: string; phReps: string
  onField: (f: keyof SetDraft, v: string) => void
  onRemove: () => void
}) {
  return (
    <>
      <span className="tabular muted" style={{ textAlign: 'center' }}>{n}</span>
      <input inputMode="decimal" aria-label={`Set ${n} weight`} value={weight} placeholder={phWeight} onChange={(e) => onField('weight', e.target.value)} />
      <input inputMode="numeric" aria-label={`Set ${n} reps`} value={reps} placeholder={phReps} onChange={(e) => onField('reps', e.target.value)} />
      <input inputMode="decimal" aria-label={`Set ${n} RPE`} value={rpe} onChange={(e) => onField('rpe', e.target.value)} />
      <button type="button" className="icon-btn" aria-label={`Remove set ${n}`} onClick={onRemove}>×</button>
    </>
  )
}
