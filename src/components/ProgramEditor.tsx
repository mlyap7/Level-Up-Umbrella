import { useState } from 'react'
import {
  addExercise, addWorkout, deleteExercise, deleteProgram, deleteWorkout, programToDraft, saveTemplate,
  updateExercise, updateProgram, updateWorkout, type FullProgram,
} from '../lib/api'
import { demoLink, programToText } from '../lib/programText'
import type { WorkoutExercise } from '../lib/types'
import { parseNumber } from '../lib/units'
import { Card, ErrorMsg } from './ui'
import { NewProgram } from './NewProgram'

// Coach-only editor. Every change saves immediately, then reloads.
export function ProgramEditor({ clientId, clientName, programs, onChanged }: { clientId: string; clientName: string; programs: FullProgram[]; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    setNotice(null)
    try {
      await fn()
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className="stack">
      <NewProgram clientId={clientId} clientName={clientName} programs={programs} onCreated={onChanged} />
      <ErrorMsg error={error} />
      {notice && <div className="alert alert-ok" role="status">{notice}</div>}
      {programs.map((p) => (
        <Card key={p.id} title={
          <div className="row">
            <h2 style={{ margin: 0 }}>{p.name}</h2>
            <span className={`badge ${p.active ? 'badge-brand' : ''}`}>{p.active ? 'Active' : 'Inactive'}</span>
          </div>
        } action={
          <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" title="Paste into Google Sheets or an AI chat to edit"
              onClick={() => void navigator.clipboard?.writeText(programToText(programToDraft(p))).then(() => setNotice(`Copied “${p.name}” as a table. Paste it into Google Sheets or an AI chat to edit it.`))}>Copy as table</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const tname = prompt('Save as a template called:', p.name)?.trim()
              if (tname) void run(async () => {
                await saveTemplate({ name: tname, description: '', notes: p.notes, workouts: programToDraft(p) })
                setNotice(`Saved “${tname}” as a template.`)
              })
            }}>Save as template</button>
            <button className="btn btn-ghost btn-sm" onClick={() => {
              const next = prompt('Program name', p.name)?.trim()
              if (next) void run(() => updateProgram(p.id, { name: next }))
            }}>Rename</button>
            <button className="btn btn-secondary btn-sm" onClick={() => void run(() => updateProgram(p.id, { active: !p.active }))}>
              {p.active ? 'Deactivate' : 'Activate'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => {
              if (confirm(`Delete “${p.name}”? Logged workouts are kept.`)) void run(() => deleteProgram(p.id))
            }}>Delete</button>
          </div>
        }>
          <NotesField initial={p.notes} onSave={(notes) => run(() => updateProgram(p.id, { notes }))} />
          {p.workouts.map((w, i) => (
            <div key={w.id} className="exercise-block">
              <div className="row-between">
                <h3 style={{ margin: 0 }}>{w.name}</h3>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" disabled={i === 0} aria-label="Move up"
                    onClick={() => void run(async () => {
                      const prev = p.workouts[i - 1]
                      await updateWorkout(w.id, { position: i - 1 })
                      await updateWorkout(prev.id, { position: i })
                    })}>↑</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    const next = prompt('Workout name', w.name)?.trim()
                    if (next) void run(() => updateWorkout(w.id, { name: next }))
                  }}>Rename</button>
                  <button className="btn btn-danger btn-sm" onClick={() => {
                    if (confirm(`Delete “${w.name}”?`)) void run(() => deleteWorkout(w.id))
                  }}>Delete</button>
                </div>
              </div>
              <ExerciseTable exercises={w.exercises} run={run} setErrorText={setError} />
              <AddExerciseForm onAdd={(fields) => run(() => addExercise(w.id, { ...fields, position: w.exercises.length }))} />
            </div>
          ))}
          <AddInline placeholder="New workout, e.g. Day A: Lower" label="Add workout"
            onAdd={(n) => run(() => addWorkout(p.id, n, p.workouts.length))} />
        </Card>
      ))}

    </div>
  )
}

function NotesField({ initial, onSave }: { initial: string; onSave: (v: string) => Promise<void> }) {
  const [v, setV] = useState(initial)
  return (
    <label className="field" style={{ marginBottom: 8 }}>Program notes <span className="hint">Shown to the client above their workouts. Saves when you click away.</span>
      <textarea rows={2} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v !== initial) void onSave(v) }} style={{ minHeight: 60 }} />
    </label>
  )
}

function ExerciseTable({ exercises, run, setErrorText }: { exercises: WorkoutExercise[]; run: (fn: () => Promise<unknown>) => Promise<void>; setErrorText: (m: string) => void }) {
  if (exercises.length === 0) return <p className="small muted" style={{ margin: '8px 0' }}>No exercises yet.</p>
  return (
    <div className="table-scroll">
      <table className="data" style={{ marginTop: 8 }}>
        <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>RPE</th><th>Rest</th><th>Tempo</th><th>Notes</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {exercises.map((e, i) => (
            <tr key={e.id}>
              <td>
                {e.name}
                <div className="small">
                  <a href={demoLink(e.name, e.video_url)} target="_blank" rel="noreferrer">{e.video_url ? 'Your video' : 'YouTube search'} ▶</a>
                  {' · '}
                  <button className="link-btn" onClick={() => {
                    const url = prompt(`Demo video link for ${e.name} (leave empty to use a YouTube search):`, e.video_url ?? '')
                    if (url == null) return
                    const v = url.trim()
                    if (v && !/^https?:\/\//i.test(v)) { setErrorText('Video links must start with https://'); return }
                    void run(() => updateExercise(e.id, { video_url: v }))
                  }}>{e.video_url ? 'Change' : 'Add video'}</button>
                </div>
              </td>
              <td>{e.target_sets ?? '–'}</td>
              <td>{e.target_reps || '–'}</td>
              <td>{e.target_rpe ?? '–'}</td>
              <td>{e.rest || '–'}</td>
              <td>{e.tempo || '–'}</td>
              <td className="small" style={{ maxWidth: 220 }}>{e.notes}</td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="icon-btn" aria-label={`Move ${e.name} up`} disabled={i === 0}
                  onClick={() => void run(async () => {
                    await updateExercise(e.id, { position: i - 1 })
                    await updateExercise(exercises[i - 1].id, { position: i })
                  })}>↑</button>
                <button className="icon-btn" aria-label={`Delete ${e.name}`} onClick={() => void run(() => deleteExercise(e.id))}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AddExerciseForm({ onAdd }: { onAdd: (f: { name: string; target_sets: number | null; target_reps: string; target_rpe: number | null; rest: string; tempo: string; notes: string }) => Promise<void> }) {
  const [name, setName] = useState('')
  const [sets, setSets] = useState('3')
  const [reps, setReps] = useState('8-10')
  const [rpe, setRpe] = useState('')
  const [rest, setRest] = useState('')
  const [tempo, setTempo] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <form className="add-exercise" style={{ marginTop: 8 }}
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        const s = parseNumber(sets)
        const r = parseNumber(rpe)
        void onAdd({
          name: name.trim(),
          target_sets: s != null && s >= 1 && s <= 20 ? Math.round(s) : null,
          target_reps: reps.trim(),
          target_rpe: r != null && r >= 1 && r <= 10 ? r : null,
          rest: rest.trim(),
          tempo: tempo.trim(),
          notes: notes.trim(),
        }).then(() => { setName(''); setNotes(''); setRpe(''); setTempo('') })
      }}>
      <input placeholder="Exercise" value={name} onChange={(e) => setName(e.target.value)} aria-label="Exercise" maxLength={80} />
      <input placeholder="Sets" value={sets} onChange={(e) => setSets(e.target.value)} aria-label="Sets" inputMode="numeric" />
      <input placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} aria-label="Reps" />
      <input placeholder="RPE" value={rpe} onChange={(e) => setRpe(e.target.value)} aria-label="Target RPE" inputMode="decimal" />
      <input placeholder="Rest" value={rest} onChange={(e) => setRest(e.target.value)} aria-label="Rest" maxLength={40} />
      <input placeholder="Tempo" value={tempo} onChange={(e) => setTempo(e.target.value)} aria-label="Tempo" maxLength={20} />
      <input placeholder="Notes (cues…)" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" />
      <button className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>Add exercise</button>
    </form>
  )
}

function AddInline({ placeholder, label, onAdd }: { placeholder: string; label: string; onAdd: (v: string) => Promise<void> }) {
  const [v, setV] = useState('')
  return (
    <form className="row" style={{ marginTop: 12 }} onSubmit={(e) => {
      e.preventDefault()
      if (v.trim()) void onAdd(v.trim()).then(() => setV(''))
    }}>
      <input className="grow" style={{ width: 'auto' }} placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} aria-label={label} maxLength={80} />
      <button className="btn btn-secondary btn-sm">{label}</button>
    </form>
  )
}
