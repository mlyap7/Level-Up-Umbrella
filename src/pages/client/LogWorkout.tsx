import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createSession, listPrograms, listSessions, type FullSession } from '../../lib/api'
import { useProfile } from '../../lib/auth'
import { demoLink } from '../../lib/programText'
import { todayISO } from '../../lib/dates'
import { FEELINGS, formatSet, lastSetsFor } from '../../lib/training'
import { kgTo, parseNumber, round, toKg } from '../../lib/units'
import { useAsync } from '../../lib/useAsync'
import {
  clearDraft, loadDraft, saveDraft,
  type ExerciseDraft, type SetDraft, type WorkoutDraft,
} from '../../lib/workoutDraft'
import { Card, ErrorMsg, Loading, RatingScale } from '../../components/ui'

const blankSet = (): SetDraft => ({ weight: '', reps: '', rpe: '', done: false })

function timeOf(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function LogWorkout() {
  const { workoutId = 'custom' } = useParams()
  const profile = useProfile()
  const navigate = useNavigate()
  const unit = profile.weight_unit

  const { data, error, loading } = useAsync(async () => {
    const [programs, sessions] = await Promise.all([listPrograms(profile.id), listSessions(profile.id, 100)])
    const workout = programs.flatMap((p) => p.workouts).find((w) => w.id === workoutId) ?? null
    return { workout, sessions }
  }, [profile.id, workoutId])

  // Pick up where they left off if the saved draft is for this workout.
  const [initialDraft] = useState(() => loadDraft(profile.id))
  const resumed = initialDraft?.workoutId === workoutId ? initialDraft : null
  const otherDraft = initialDraft && !resumed ? initialDraft : null

  const [exercises, setExercises] = useState<ExerciseDraft[]>(resumed?.exercises ?? [])
  const [date, setDate] = useState(resumed?.date ?? todayISO())
  const [feeling, setFeeling] = useState<number | null>(resumed?.feeling ?? null)
  const [remarks, setRemarks] = useState(resumed?.remarks ?? '')
  const [customName, setCustomName] = useState(resumed?.customName ?? '')
  const [newExercise, setNewExercise] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showResumed, setShowResumed] = useState(Boolean(resumed))
  // Only start saving a draft once they actually log something, so just
  // opening a workout to look at it doesn't leave an "unfinished workout".
  const touched = useRef(Boolean(resumed))
  const startedAt = useRef(resumed?.startedAt ?? Date.now())
  const touch = () => { touched.current = true }

  useEffect(() => {
    if (resumed || !data?.workout) return
    setExercises(data.workout.exercises.map((e) => ({
      name: e.name,
      target: [e.target_sets && `${e.target_sets} sets`, e.target_reps && `${e.target_reps} reps`, e.target_rpe && `RPE ${e.target_rpe}`,
        e.rest && `Rest ${e.rest}`, e.tempo && `Tempo ${e.tempo}`].filter(Boolean).join(' · '),
      notes: e.notes,
      video: e.video_url ?? '',
      sets: Array.from({ length: e.target_sets ?? 3 }, blankSet),
    })))
  }, [data?.workout]) // eslint-disable-line react-hooks/exhaustive-deps

  const workoutName = data?.workout?.name ?? (customName.trim() || 'Custom workout')

  // Auto-save after every change.
  useEffect(() => {
    if (!touched.current) return
    const draft: WorkoutDraft = {
      workoutId, workoutName, date, customName, exercises, feeling, remarks,
      startedAt: startedAt.current, savedAt: Date.now(),
    }
    saveDraft(profile.id, draft)
  }, [exercises, date, feeling, remarks, customName, workoutId, workoutName, profile.id])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load workout.'} />
  if (workoutId !== 'custom' && !data.workout) {
    return <Card><div className="empty">That workout wasn’t found. <Link to="/training">Back to training</Link></div></Card>
  }

  const update = (i: number, fn: (e: ExerciseDraft) => ExerciseDraft) => {
    touch()
    setExercises((xs) => xs.map((x, j) => (j === i ? fn(x) : x)))
  }

  function addExercise(e: FormEvent) {
    e.preventDefault()
    if (!newExercise.trim()) return
    touch()
    setExercises((xs) => [...xs, { name: newExercise.trim(), target: '', notes: '', sets: [blankSet(), blankSet(), blankSet()] }])
    setNewExercise('')
  }

  function discard() {
    if (!confirm('Discard this workout? Everything you logged in it will be deleted.')) return
    clearDraft(profile.id)
    navigate('/training')
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
        workout_name: workoutName,
        performed_on: date, feeling, remarks: remarks.trim(), sets,
      })
      clearDraft(profile.id)
      navigate('/training')
    } catch (err) {
      setFormError(`${err instanceof Error ? err.message : 'Could not save.'} Your sets are still saved on this phone, so you can try again.`)
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div>
        <Link to="/training" className="small">← Training</Link>
        <h1 style={{ marginTop: 4 }}>{data.workout?.name ?? 'Custom workout'}</h1>
        <p className="small muted" style={{ margin: 0 }}>Everything you enter saves automatically on this phone. You can switch apps and come back.</p>
      </div>

      {showResumed && resumed && (
        <div className="alert alert-info row-between" role="status">
          <span>Welcome back! Picked up your workout from {timeOf(resumed.savedAt)}.</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowResumed(false)}>OK</button>
        </div>
      )}
      {otherDraft && !touched.current && (
        <div className="alert alert-info">
          You have an unfinished workout: <strong>{otherDraft.workoutName}</strong> from {timeOf(otherDraft.savedAt)}.{' '}
          <Link to={`/training/log/${otherDraft.workoutId}`}>Continue that one</Link>. Logging here replaces it.
        </div>
      )}

      <Card>
        <div className="form-row">
          <label className="field">Date
            <input type="date" value={date} max={todayISO()} onChange={(e) => { touch(); setDate(e.target.value || todayISO()) }} />
          </label>
          {!data.workout && (
            <label className="field">Workout name
              <input value={customName} onChange={(e) => { touch(); setCustomName(e.target.value) }} placeholder="e.g. Hotel gym" />
            </label>
          )}
        </div>
      </Card>

      <Card>
        {exercises.length === 0 && <div className="empty">Add your first exercise below.</div>}
        {exercises.some((ex) => ex.target.includes('Tempo')) && (
          <p className="small muted" style={{ margin: '0 0 4px' }}>
            Tempo 3-1-1 means 3 seconds lowering, 1 second pause, 1 second lifting.
          </p>
        )}
        {exercises.map((ex, i) => (
          <ExerciseEditor key={`${ex.name}-${i}`} ex={ex} unit={unit} sessions={data.sessions}
            onChange={(fn) => update(i, fn)}
            onRemove={() => { touch(); setExercises((xs) => xs.filter((_, j) => j !== i)) }} />
        ))}
        <form className="row" onSubmit={addExercise} style={{ marginTop: 12 }}>
          <input className="grow" style={{ width: 'auto' }} placeholder="Add an exercise" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} aria-label="Exercise name" maxLength={80} />
          <button className="btn btn-secondary btn-sm">Add</button>
        </form>
      </Card>

      <Card title="How did it feel?">
        <div className="stack">
          <RatingScale label="How the session felt" value={feeling} onChange={(v) => { touch(); setFeeling(v) }} max={5} low={FEELINGS[0]} high={FEELINGS[4]} />
          <label className="field">Remarks
            <textarea value={remarks} onChange={(e) => { touch(); setRemarks(e.target.value) }} rows={3} placeholder="Energy, pain or niggles, technique notes, what to change next time…" />
          </label>
          <ErrorMsg error={formError} />
          <button className="btn" onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : 'Finish and save workout'}</button>
          <button className="btn btn-danger btn-sm" style={{ alignSelf: 'center' }} onClick={discard}>Discard workout</button>
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
  const setAt = (j: number, fn: (s: SetDraft) => SetDraft) =>
    onChange((e) => ({ ...e, sets: e.sets.map((s, k) => (k === j ? fn(s) : s)) }))
  const doneCount = ex.sets.filter((s) => s.done).length

  return (
    <div className="exercise-block">
      <div className="row-between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <strong>{ex.name}</strong>
          <a className="small" href={demoLink(ex.name, ex.video)} target="_blank" rel="noreferrer" style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>How to ▶</a>
          {doneCount > 0 && <span className="small muted" style={{ marginLeft: 8 }}>{doneCount}/{ex.sets.length} done</span>}
          {ex.target && <div><span className="badge badge-brand">{ex.target}</span></div>}
        </div>
        <button className="icon-btn" aria-label={`Remove ${ex.name}`} onClick={() => { if (confirm(`Remove ${ex.name} from this workout?`)) onRemove() }}>×</button>
      </div>
      {ex.notes && <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{ex.notes}</div>}
      <div className="prev">
        {last ? <>Last time: <span className="tabular">{last.sets.map((s) => formatSet(s, unit)).join(', ')}</span></> : 'First time logging this exercise'}
      </div>
      <div className="set-grid" style={{ marginTop: 8 }}>
        <span className="head">Set</span><span className="head">Weight ({unit})</span><span className="head">Reps</span><span className="head">RPE</span><span className="head" style={{ textAlign: 'center' }}>Done</span><span />
        {ex.sets.map((s, j) => {
          const prev = last?.sets[j]
          const phWeight = prev?.weight_kg != null ? String(round(kgTo(prev.weight_kg, unit))) : ''
          const phReps = prev?.reps != null ? String(prev.reps) : ''
          return (
            <SetRow key={j} n={j + 1} set={s} phWeight={phWeight} phReps={phReps}
              onField={(f, v) => setAt(j, (x) => ({ ...x, [f]: v }))}
              onToggleDone={() => setAt(j, (x) => {
                // Ticking an empty set means "same as last time".
                if (!x.done && !x.weight && !x.reps) return { ...x, weight: phWeight, reps: phReps, done: true }
                return { ...x, done: !x.done }
              })}
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

function SetRow({ n, set, phWeight, phReps, onField, onToggleDone, onRemove }: {
  n: number; set: SetDraft; phWeight: string; phReps: string
  onField: (f: 'weight' | 'reps' | 'rpe', v: string) => void
  onToggleDone: () => void
  onRemove: () => void
}) {
  const cls = set.done ? 'set-done' : ''
  return (
    <>
      <span className={`tabular muted ${cls}`} style={{ textAlign: 'center' }}>{n}</span>
      <input className={cls} inputMode="decimal" aria-label={`Set ${n} weight`} value={set.weight} placeholder={phWeight} onChange={(e) => onField('weight', e.target.value)} />
      <input className={cls} inputMode="numeric" aria-label={`Set ${n} reps`} value={set.reps} placeholder={phReps} onChange={(e) => onField('reps', e.target.value)} />
      <input className={cls} inputMode="decimal" aria-label={`Set ${n} RPE`} value={set.rpe} onChange={(e) => onField('rpe', e.target.value)} />
      <button type="button" className={`done-btn ${set.done ? 'on' : ''}`} aria-pressed={set.done} aria-label={`Mark set ${n} done`} onClick={onToggleDone}>✓</button>
      <button type="button" className="icon-btn" aria-label={`Remove set ${n}`} onClick={onRemove}>×</button>
    </>
  )
}
