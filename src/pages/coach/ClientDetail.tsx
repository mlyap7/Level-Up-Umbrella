import { NavLink, Route, Routes, useParams, Link } from 'react-router-dom'
import {
  getProfile, listCheckIns, listComments, listJournal, listPrograms, listSessions, setClientArchived,
} from '../../lib/api'
import { useProfile } from '../../lib/auth'
import { formatFullDate, toISODate } from '../../lib/dates'
import { useAsync } from '../../lib/useAsync'
import { useProgressData } from '../../lib/useProgressData'
import { cmTo, kgTo, round } from '../../lib/units'
import { CheckInCard } from '../../components/CheckInCard'
import { JournalList } from '../../components/JournalList'
import { ProgramEditor } from '../../components/ProgramEditor'
import { ProgressPanel } from '../../components/ProgressPanel'
import { SessionHistory } from '../../components/SessionHistory'
import { PhotosView } from '../../components/PhotosView'
import { Card, ErrorMsg, Loading } from '../../components/ui'
import type { Profile } from '../../lib/types'

const GOALS = { lose: 'Lose fat', gain: 'Build muscle / gain', maintain: 'Maintain / recomp' }

export function ClientDetail() {
  const coach = useProfile()
  const { clientId = '' } = useParams()
  const { data: client, error, loading, reload } = useAsync(() => getProfile(clientId), [clientId])

  if (loading && !client) return <Loading />
  if (error || !client) return <ErrorMsg error={error ?? 'Client not found.'} />

  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')
  // Absolute paths: relative links inside a splat route would stack up.
  const base = `/coach/clients/${client.id}`
  return (
    <div className="stack">
      <div>
        <Link to="/coach" className="small">← All clients</Link>
        <div className="row-between" style={{ marginTop: 4 }}>
          <div>
            <h1 style={{ marginBottom: 2 }}>{client.full_name || 'Unnamed client'}</h1>
            <div className="small muted">
              {GOALS[client.goal_type]}
              {client.height_cm != null && ` · ${round(cmTo(client.height_cm, client.length_unit))} ${client.length_unit}`}
              {client.goal_weight_kg != null && ` · Target ${round(kgTo(Number(client.goal_weight_kg), coach.weight_unit))} ${coach.weight_unit}`}
              {client.coaching_started_on
                ? ` · Coaching since ${formatFullDate(client.coaching_started_on)}`
                : ` · Joined ${formatFullDate(toISODate(new Date(client.created_at)))}`}
              {client.onboarded_at === null && ' · Setup not finished'}
              {client.archived && ' · Archived'}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            const archive = !client.archived
            if (archive && !confirm(`Archive ${client.full_name}? Their data is kept and you can restore them later.`)) return
            await setClientArchived(client.id, archive)
            reload()
          }}>{client.archived ? 'Restore client' : 'Archive client'}</button>
        </div>
        {client.goal_note && <p className="small" style={{ marginTop: 8, marginBottom: 0 }}><span className="muted">In their words:</span> {client.goal_note}</p>}
      </div>
      <nav className="tabs" aria-label="Client sections">
        <NavLink to={base} end className={cls}>Progress</NavLink>
        <NavLink to={`${base}/check-ins`} className={cls}>Check-ins</NavLink>
        <NavLink to={`${base}/training`} className={cls}>Training</NavLink>
        <NavLink to={`${base}/photos`} className={cls}>Photos</NavLink>
        <NavLink to={`${base}/journal`} className={cls}>Journal</NavLink>
      </nav>
      <Routes>
        <Route index element={<ClientProgress client={client} />} />
        <Route path="check-ins" element={<ClientCheckIns client={client} />} />
        <Route path="training" element={<ClientTraining client={client} />} />
        <Route path="photos" element={<PhotosView clientId={client.id} editable={false} startedOn={client.coaching_started_on ?? null} />} />
        <Route path="journal" element={<ClientJournal client={client} />} />
      </Routes>
    </div>
  )
}

function ClientProgress({ client }: { client: Profile }) {
  const coach = useProfile()
  const { data, error, loading } = useProgressData(client.id)
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load.'} />
  return <ProgressPanel data={data} weightUnit={coach.weight_unit} lengthUnit={coach.length_unit} editable={false} />
}

function ClientCheckIns({ client }: { client: Profile }) {
  const coach = useProfile()
  const { data, error, loading, reload } = useAsync(async () => {
    const checkIns = await listCheckIns(client.id)
    return { checkIns, comments: await listComments(checkIns.map((c) => c.id)) }
  }, [client.id])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load.'} />
  if (data.checkIns.length === 0) return <Card><div className="empty">No check-ins yet.</div></Card>
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      {data.checkIns.map((c) => (
        <CheckInCard key={c.id} checkIn={c} comments={data.comments.filter((x) => x.check_in_id === c.id)}
          viewerId={coach.id} clientName={client.full_name.split(' ')[0] || 'Client'} onChanged={reload} />
      ))}
    </div>
  )
}

function ClientTraining({ client }: { client: Profile }) {
  const coach = useProfile()
  const { data, error, loading, reload } = useAsync(async () => {
    const [programs, sessions] = await Promise.all([listPrograms(client.id), listSessions(client.id)])
    return { programs, sessions }
  }, [client.id])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load.'} />
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <h2>Programs</h2>
        <ProgramEditor clientId={client.id} programs={data.programs} onChanged={reload} />
      </div>
      <div className="stack">
        <h2>Logged workouts</h2>
        <Card><SessionHistory sessions={data.sessions} weightUnit={coach.weight_unit} editable={false} /></Card>
      </div>
    </div>
  )
}

function ClientJournal({ client }: { client: Profile }) {
  const { data, error, loading } = useAsync(() => listJournal(client.id), [client.id])
  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load.'} />
  return <Card><JournalList entries={data} editable={false} /></Card>
}
