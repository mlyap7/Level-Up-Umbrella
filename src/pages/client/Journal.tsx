import { useState, type FormEvent } from 'react'
import { addJournal, listJournal } from '../../lib/api'
import { useProfile } from '../../lib/auth'
import { todayISO } from '../../lib/dates'
import { useAsync } from '../../lib/useAsync'
import { JournalList } from '../../components/JournalList'
import { Card, ErrorMsg, Loading, MOODS, RatingScale } from '../../components/ui'

const PROMPTS = [
  'What went well today?',
  'What felt hard, and why?',
  'How are hunger, cravings and energy?',
  'Anything you want your coach to know?',
]

export function Journal() {
  const profile = useProfile()
  const { data, error, loading, reload } = useAsync(() => listJournal(profile.id), [profile.id])
  const [date, setDate] = useState(todayISO())
  const [mood, setMood] = useState<number | null>(null)
  const [body, setBody] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return setFormError('Write a few words first.')
    setBusy(true)
    setFormError(null)
    try {
      await addJournal(profile.id, { entry_date: date, mood, body: body.trim() })
      setBody('')
      setMood(null)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Journal</h1>
      <Card title="New entry">
        <form className="stack" onSubmit={submit}>
          <label className="field">Date
            <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
          </label>
          <div className="field">
            <span className="small" style={{ fontWeight: 500, color: 'var(--text-2)' }}>Mood</span>
            <RatingScale label="Mood" value={mood} onChange={setMood} max={5} low={MOODS[0]} high={MOODS[4]} />
          </div>
          <label className="field">How are you feeling?
            <span className="hint">Try: {PROMPTS.join(' · ')}</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} rows={5} />
          </label>
          <ErrorMsg error={formError} />
          <button className="btn" disabled={busy}>Save entry</button>
        </form>
      </Card>
      <Card title="Past entries">
        {loading && !data ? <Loading /> : error ? <ErrorMsg error={error} /> : <JournalList entries={data ?? []} editable onChanged={reload} />}
      </Card>
    </div>
  )
}
