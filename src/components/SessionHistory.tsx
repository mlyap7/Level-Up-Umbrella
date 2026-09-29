import { deleteSession, type FullSession } from '../lib/api'
import { formatFullDate } from '../lib/dates'
import { feelingLabel, formatSet, groupSets } from '../lib/training'
import type { WeightUnit } from '../lib/types'

export function SessionHistory({ sessions, weightUnit, editable, onChanged }: {
  sessions: FullSession[]
  weightUnit: WeightUnit
  editable: boolean
  onChanged?: () => void
}) {
  if (sessions.length === 0) return <div className="empty">No workouts logged yet.</div>
  return (
    <div>
      {sessions.map((s) => (
        <article key={s.id} className="list-item">
          <div className="row-between">
            <div className="row">
              <strong>{s.workout_name || 'Workout'}</strong>
              <span className="muted small">{formatFullDate(s.performed_on)}</span>
              {s.feeling && <span className="badge">Felt: {feelingLabel(s.feeling)}</span>}
            </div>
            {editable && (
              <button className="btn btn-danger btn-sm" onClick={async () => {
                if (!confirm('Delete this workout log?')) return
                await deleteSession(s.id)
                onChanged?.()
              }}>Delete</button>
            )}
          </div>
          <div className="stack-sm" style={{ marginTop: 6 }}>
            {groupSets(s.sets).map((g) => (
              <div key={g.name} className="small">
                <strong>{g.name}</strong>: <span className="tabular">{g.sets.map((x) => formatSet(x, weightUnit)).join(', ')}</span>
              </div>
            ))}
          </div>
          {s.remarks && <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}><span className="muted">Remarks:</span> {s.remarks}</p>}
        </article>
      ))}
    </div>
  )
}
