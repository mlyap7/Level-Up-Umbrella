import { useEffect, useState, type FormEvent } from 'react'
import { listCheckIns, listComments, upsertCheckIn, type CheckInFields } from '../../lib/api'
import { useProfile } from '../../lib/auth'
import { addDays, formatWeekOf, todayISO, weekStart } from '../../lib/dates'
import { useAsync } from '../../lib/useAsync'
import { CheckInCard, RATING_FIELDS } from '../../components/CheckInCard'
import { Card, ErrorMsg, Loading, RatingScale } from '../../components/ui'

type Ratings = Record<(typeof RATING_FIELDS)[number]['key'], number | null>
const EMPTY: Ratings = { adherence: null, energy: null, sleep_quality: null, hunger: null, stress: null, digestion: null }

/** Monday to Wednesday you're most likely reviewing last week; later in the week, this one. */
function defaultWeek(today = todayISO()): string {
  const monday = weekStart(today)
  const dow = (new Date(today + 'T12:00').getDay() + 6) % 7
  return dow <= 2 ? addDays(monday, -7) : monday
}

export function CheckIns() {
  const profile = useProfile()
  const { data, error, loading, reload } = useAsync(async () => {
    const checkIns = await listCheckIns(profile.id)
    const comments = await listComments(checkIns.map((c) => c.id))
    return { checkIns, comments }
  }, [profile.id])

  const [week, setWeek] = useState(defaultWeek())
  const [ratings, setRatings] = useState<Ratings>(EMPTY)
  const [wins, setWins] = useState('')
  const [struggles, setStruggles] = useState('')
  const [questions, setQuestions] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const existing = data?.checkIns.find((c) => c.week_start === week)
  useEffect(() => {
    setRatings(existing ? {
      adherence: existing.adherence, energy: existing.energy, sleep_quality: existing.sleep_quality,
      hunger: existing.hunger, stress: existing.stress, digestion: existing.digestion,
    } : EMPTY)
    setWins(existing?.wins ?? '')
    setStruggles(existing?.struggles ?? '')
    setQuestions(existing?.questions ?? '')
    setSaved(false)
  }, [existing?.id, week]) // eslint-disable-line react-hooks/exhaustive-deps

  const weeks = [0, 1, 2, 3].map((i) => addDays(weekStart(todayISO()), -7 * i))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const missing = RATING_FIELDS.filter((f) => ratings[f.key] == null)
    if (missing.length) return setFormError(`Rate: ${missing.map((m) => m.label.toLowerCase()).join(', ')}.`)
    setBusy(true)
    setFormError(null)
    try {
      await upsertCheckIn(profile.id, { week_start: week, ...(ratings as Record<keyof Ratings, number>), wins, struggles, questions } as CheckInFields)
      setSaved(true)
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Weekly check-in</h1>
      <Card title={existing ? 'Update your check-in' : 'How did this week go?'}>
        <form className="stack" onSubmit={submit}>
          <label className="field">Week
            <select value={week} onChange={(e) => setWeek(e.target.value)}>
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {formatWeekOf(w)}{data?.checkIns.some((c) => c.week_start === w) ? ' (submitted)' : ''}
                </option>
              ))}
            </select>
          </label>
          {RATING_FIELDS.map((f) => (
            <div key={f.key} className="field">
              <span className="small" style={{ fontWeight: 500, color: 'var(--text-2)' }}>{f.label}</span>
              <RatingScale label={f.label} value={ratings[f.key]} onChange={(v) => setRatings((r) => ({ ...r, [f.key]: v }))} low={f.low} high={f.high} />
            </div>
          ))}
          <label className="field">Wins this week
            <textarea value={wins} onChange={(e) => setWins(e.target.value)} rows={3} placeholder="Big or small. Hit your steps, tried a new recipe, PR in the gym…" />
          </label>
          <label className="field">Struggles
            <textarea value={struggles} onChange={(e) => setStruggles(e.target.value)} rows={3} placeholder="What got in the way?" />
          </label>
          <label className="field">Questions for your coach
            <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={2} />
          </label>
          <ErrorMsg error={formError} />
          {saved && <div className="alert alert-ok" role="status">Check-in sent to your coach.</div>}
          <button className="btn" disabled={busy}>{existing ? 'Update check-in' : 'Submit check-in'}</button>
        </form>
      </Card>

      <h2 style={{ marginTop: 8 }}>Past check-ins</h2>
      {loading && !data ? <Loading /> : error ? <ErrorMsg error={error} /> : data!.checkIns.length === 0 ? (
        <div className="card empty">Your check-ins and your coach’s replies show up here.</div>
      ) : (
        data!.checkIns.map((c) => (
          <CheckInCard key={c.id} checkIn={c} comments={data!.comments.filter((x) => x.check_in_id === c.id)}
            viewerId={profile.id} clientName={profile.full_name} onChanged={reload} />
        ))
      )}
    </div>
  )
}
