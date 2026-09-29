import { Link } from 'react-router-dom'
import { listPrograms, listSessions } from '../../lib/api'
import { useProfile } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { SessionHistory } from '../../components/SessionHistory'
import { Card, ErrorMsg, Loading } from '../../components/ui'

export function Training() {
  const profile = useProfile()
  const { data, error, loading, reload } = useAsync(async () => {
    const [programs, sessions] = await Promise.all([listPrograms(profile.id), listSessions(profile.id)])
    return { programs, sessions }
  }, [profile.id])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load training.'} />

  const active = data.programs.filter((p) => p.active)
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <div className="row-between">
        <h1>Training</h1>
        <Link to="/training/log/custom" className="btn btn-secondary btn-sm">Log a custom workout</Link>
      </div>

      {active.length === 0 ? (
        <Card><div className="empty">Your coach hasn’t assigned a program yet. You can still log a custom workout.</div></Card>
      ) : (
        active.map((p) => (
          <Card key={p.id} title={p.name}>
            {p.notes && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{p.notes}</p>}
            {p.workouts.length === 0 && <div className="empty">No workouts in this program yet.</div>}
            <div className="stack-sm">
              {p.workouts.map((w) => (
                <div key={w.id} className="list-item row-between">
                  <div>
                    <strong>{w.name}</strong>
                    <div className="small muted">{w.exercises.map((e) => e.name).join(' · ') || 'No exercises yet'}</div>
                  </div>
                  <Link to={`/training/log/${w.id}`} className="btn btn-sm">Start</Link>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <Card title="Workout history">
        <SessionHistory sessions={data.sessions} weightUnit={profile.weight_unit} editable onChanged={reload} />
      </Card>
    </div>
  )
}
