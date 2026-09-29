import { deleteJournal } from '../lib/api'
import { formatFullDate } from '../lib/dates'
import type { JournalEntry } from '../lib/types'
import { moodLabel } from './ui'

export function JournalList({ entries, editable, onChanged }: { entries: JournalEntry[]; editable: boolean; onChanged?: () => void }) {
  if (entries.length === 0) return <div className="empty">No journal entries yet.</div>
  return (
    <div>
      {entries.map((e) => (
        <article key={e.id} className="list-item">
          <div className="row-between">
            <div className="row">
              <strong>{formatFullDate(e.entry_date)}</strong>
              {e.mood && <span className="badge">Mood: {moodLabel(e.mood)}</span>}
            </div>
            {editable && (
              <button className="btn btn-danger btn-sm" onClick={async () => {
                if (!confirm('Delete this journal entry?')) return
                await deleteJournal(e.id)
                onChanged?.()
              }}>Delete</button>
            )}
          </div>
          <p style={{ whiteSpace: 'pre-wrap', marginTop: 6, marginBottom: 0 }}>{e.body}</p>
        </article>
      ))}
    </div>
  )
}
