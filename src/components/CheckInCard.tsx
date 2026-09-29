import { useState, type FormEvent } from 'react'
import { addComment, deleteComment } from '../lib/api'
import { formatWeekOf } from '../lib/dates'
import { RATING_THRESHOLDS } from '../lib/stats'
import type { CheckIn, CheckInComment } from '../lib/types'
import { ErrorMsg } from './ui'

export const RATING_FIELDS = [
  { key: 'adherence', label: 'Plan adherence', low: 'Off plan', high: 'Nailed it' },
  { key: 'energy', label: 'Energy', low: 'Drained', high: 'Energised' },
  { key: 'sleep_quality', label: 'Sleep quality', low: 'Poor', high: 'Great' },
  { key: 'hunger', label: 'Hunger', low: 'Not hungry', high: 'Starving' },
  { key: 'stress', label: 'Stress', low: 'Calm', high: 'Very stressed' },
  { key: 'digestion', label: 'Digestion', low: 'Poor', high: 'Great' },
] as const

function isFlagged(key: keyof typeof RATING_THRESHOLDS, v: number) {
  const t: { low?: number; high?: number } = RATING_THRESHOLDS[key]
  return (t.low != null && v <= t.low) || (t.high != null && v >= t.high)
}

export function CheckInCard({ checkIn, comments, viewerId, clientName, onChanged }: {
  checkIn: CheckIn
  comments: CheckInComment[]
  viewerId: string
  clientName: string
  onChanged: () => void
}) {
  const [reply, setReply] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const viewerIsClient = viewerId === checkIn.client_id

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!reply.trim()) return
    setBusy(true)
    setError(null)
    try {
      await addComment(checkIn.id, viewerId, reply)
      setReply('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send.')
    } finally {
      setBusy(false)
    }
  }

  const texts = [
    { label: 'Wins', value: checkIn.wins },
    { label: 'Struggles', value: checkIn.struggles },
    { label: 'Questions for coach', value: checkIn.questions },
  ].filter((t) => t.value.trim())

  return (
    <article className="card">
      <div className="card-title">
        <h2>{formatWeekOf(checkIn.week_start)}</h2>
        {comments.some((c) => c.author_id !== checkIn.client_id)
          ? <span className="badge badge-good">✓ Coach replied</span>
          : <span className="badge">Awaiting reply</span>}
      </div>
      <div className="ratings">
        {RATING_FIELDS.map((f) => {
          const v = checkIn[f.key]
          const flagged = isFlagged(f.key, v)
          return (
            <div key={f.key} className={flagged ? 'flagged' : ''}>
              {f.label}: <strong className="tabular">{v}/10</strong>{flagged && <span aria-label="needs attention"> ⚑</span>}
            </div>
          )
        })}
      </div>
      {texts.map((t) => (
        <div key={t.label} style={{ marginTop: 12 }}>
          <div className="small muted">{t.label}</div>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{t.value}</p>
        </div>
      ))}

      <div className="thread" aria-label="Conversation">
        {comments.map((c) => {
          const fromClient = c.author_id === checkIn.client_id
          return (
            <div key={c.id} className={`comment ${fromClient ? '' : 'coach'}`}>
              <div className="comment-meta">
                <strong>{fromClient ? (viewerIsClient ? 'You' : clientName) : viewerIsClient ? 'Coach' : 'You'}</strong>
                {' · '}{new Date(c.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                {c.author_id === viewerId && (
                  <button className="link-btn" style={{ marginLeft: 8, fontSize: '.75rem' }} onClick={async () => {
                    if (!confirm('Delete this message?')) return
                    await deleteComment(c.id)
                    onChanged()
                  }}>Delete</button>
                )}
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{c.body}</div>
            </div>
          )
        })}
        <form className="stack-sm" onSubmit={send}>
          <textarea
            value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={5000}
            placeholder={viewerIsClient ? 'Reply to your coach…' : `Feedback for ${clientName}…`}
            aria-label="Reply"
            style={{ minHeight: 64 }}
          />
          <ErrorMsg error={error} />
          <div><button className="btn btn-sm" disabled={busy || !reply.trim()}>Send</button></div>
        </form>
      </div>
    </article>
  )
}
