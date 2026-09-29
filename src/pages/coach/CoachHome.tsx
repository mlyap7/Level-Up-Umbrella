import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAllDailyLogs, listClients, listComments, listRecentCheckIns } from '../../lib/api'
import { addDays, relativeDays, todayISO, toISODate } from '../../lib/dates'
import { attentionScore, clientFlags, weightSummary } from '../../lib/stats'
import { useProfile } from '../../lib/auth'
import { useAsync } from '../../lib/useAsync'
import { formatChange, kgTo } from '../../lib/units'
import { Card, ErrorMsg, Loading } from '../../components/ui'

export function CoachHome() {
  const coach = useProfile()
  const [showArchived, setShowArchived] = useState(false)
  const [query, setQuery] = useState('')
  const today = todayISO()

  const { data, error, loading } = useAsync(async () => {
    const [clients, logs, checkIns] = await Promise.all([
      listClients(),
      listAllDailyLogs(addDays(today, -42)),
      listRecentCheckIns(addDays(today, -42)),
    ])
    const comments = await listComments(checkIns.map((c) => c.id))
    return { clients, logs, checkIns, comments }
  }, [today])

  const rows = useMemo(() => {
    if (!data) return []
    return data.clients.map((c) => {
      const logs = data.logs.filter((l) => l.client_id === c.id)
      const checkIns = data.checkIns.filter((x) => x.client_id === c.id)
      const flags = clientFlags({
        goalType: c.goal_type, joinedOn: toISODate(new Date(c.created_at)), logs, checkIns,
        comments: data.comments.filter((x) => checkIns.some((ci) => ci.id === x.check_in_id)),
        clientId: c.id, today,
      })
      return { client: c, flags, summary: weightSummary(logs), score: attentionScore(flags) }
    }).sort((a, b) => b.score - a.score || a.client.full_name.localeCompare(b.client.full_name))
  }, [data, today])

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load clients.'} />

  const visible = rows.filter((r) => r.client.archived === showArchived &&
    r.client.full_name.toLowerCase().includes(query.trim().toLowerCase()))
  const active = rows.filter((r) => !r.client.archived)
  const needAttention = active.filter((r) => r.score > 0).length
  const awaitingReply = active.filter((r) => r.flags.some((f) => f.label.startsWith('Check-in awaiting'))).length
  const unit = coach.weight_unit

  return (
    <div className="stack">
      <h1>Clients</h1>
      <div className="stats card" style={{ marginBottom: 0 }}>
        <div><div className="stat-label">Active clients</div><div className="stat-value">{active.length}</div></div>
        <div><div className="stat-label">Need attention</div><div className="stat-value">{needAttention}</div></div>
        <div><div className="stat-label">Check-ins to reply to</div><div className="stat-value">{awaitingReply}</div></div>
      </div>

      <Card>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <input style={{ maxWidth: 280 }} placeholder="Search clients" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search clients" />
          <div className="segmented" role="group" aria-label="Filter">
            <button aria-pressed={!showArchived} onClick={() => setShowArchived(false)}>Active</button>
            <button aria-pressed={showArchived} onClick={() => setShowArchived(true)}>Archived</button>
          </div>
        </div>
        {visible.length === 0 ? (
          <div className="empty">
            {rows.length === 0 ? 'No clients yet. Share your sign-up link and code from Settings.' : 'No clients match.'}
          </div>
        ) : (
          <div>
            <div className="client-row client-row-head small muted" style={{ borderBottom: '1px solid var(--border)' }}>
              <span>Client</span><span>7-day avg</span><span>Last weigh-in</span><span>Needs attention</span>
            </div>
            {visible.map(({ client, flags, summary }) => (
              <Link key={client.id} to={`/coach/clients/${client.id}`} className="client-row">
                <div>
                  <strong>{client.full_name || 'Unnamed client'}</strong>
                  <div className="small muted">Goal: {client.goal_type === 'lose' ? 'lose fat' : client.goal_type === 'gain' ? 'gain' : 'maintain'}</div>
                </div>
                <div className="tabular">
                  {summary.currentAvg != null ? `${kgTo(summary.currentAvg, unit).toFixed(1)} ${unit}` : '–'}
                  {summary.weekChange != null && (
                    <div className="small muted">{formatChange(kgTo(summary.weekChange, unit), '')} this wk</div>
                  )}
                </div>
                <div className="small">{summary.latestDate ? relativeDays(summary.latestDate, today) : 'Never'}</div>
                <div className="flags">
                  {flags.length === 0 ? <span className="badge badge-good">✓ On track</span> : flags.map((f) => (
                    <span key={f.label} className={`badge ${f.level === 'critical' ? 'badge-crit' : 'badge-warn'}`}>
                      {f.level === 'critical' ? '●' : '▲'} {f.label}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
