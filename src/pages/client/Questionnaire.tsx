import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { claimQuestionnaireImport, getQuestionnaire, saveQuestionnaire } from '../../lib/api'
import { useProfile } from '../../lib/auth'
import { formatFullDate, toISODate } from '../../lib/dates'
import {
  isVisible, missingAnswers, progress, QUESTIONNAIRE, type Answers, type Question,
} from '../../lib/questionnaire'
import { useAsync } from '../../lib/useAsync'
import { Card, ErrorMsg, Loading, RatingScale } from '../../components/ui'

export function QuestionnairePage() {
  const profile = useProfile()
  const navigate = useNavigate()
  const { data, error, loading } = useAsync(async () => {
    await claimQuestionnaireImport()
    return getQuestionnaire(profile.id)
  }, [profile.id])

  const [answers, setAnswers] = useState<Answers>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [showMissing, setShowMissing] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const loaded = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (data !== null && data !== undefined) setAnswers(data.answers as Answers)
    if (!loading) loaded.current = true
  }, [data, loading])

  // Autosave shortly after they stop typing.
  function update(key: string, value: Answers[string]) {
    setAnswers((a) => {
      const next = { ...a, [key]: value }
      window.clearTimeout(timer.current)
      setStatus('saving')
      timer.current = window.setTimeout(() => {
        saveQuestionnaire(profile.id, next).then(() => setStatus('saved'), () => setStatus('error'))
      }, 700)
      return next
    })
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  if (loading && !loaded.current) return <Loading />
  if (error) return <ErrorMsg error={error} />

  const missing = missingAnswers(answers)
  const missingKeys = new Set(missing.map((q) => q.key))
  const p = progress(answers)
  const submitted = Boolean(data?.submitted_at)

  async function submit() {
    setSubmitError(null)
    if (missing.length) {
      setShowMissing(true)
      document.getElementById(`q-${missing[0].key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return setSubmitError(`${missing.length} required ${missing.length === 1 ? 'answer is' : 'answers are'} missing (marked in red).`)
    }
    setBusy(true)
    window.clearTimeout(timer.current)
    try {
      await saveQuestionnaire(profile.id, answers, !submitted)
      navigate('/', { replace: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit. Your answers are saved; try again.')
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div>
        <Link to="/" className="small">← Progress</Link>
        <h1 style={{ marginTop: 4 }}>Your coaching questionnaire</h1>
        <p className="small muted" style={{ margin: 0 }}>
          About 8 minutes. Your answers save automatically, so you can stop and come back. 🔒 Only you and your coaching team can see them.
        </p>
      </div>

      {data?.imported && (
        <div className="alert alert-info small">
          We’ve brought over your answers from your onboarding form ({formatFullDate(toISODate(new Date(data.submitted_at ?? data.updated_at)))}). Have a quick look and update anything that’s changed.
        </div>
      )}

      <div className="q-progress" aria-label={`${p.done} of ${p.total} required answers`}>
        <div style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
      </div>

      {QUESTIONNAIRE.map((section) => (
        <Card key={section.id} title={section.title}>
          {section.intro && <p className="small muted" style={{ marginTop: -4 }}>{section.intro}</p>}
          <div className="stack">
            {section.questions.filter((q) => isVisible(q, answers)).map((q) => (
              <QuestionField key={q.key} q={q} value={answers[q.key]} onChange={(v) => update(q.key, v)}
                invalid={showMissing && missingKeys.has(q.key)} />
            ))}
          </div>
        </Card>
      ))}

      <Card>
        <div className="stack-sm">
          <ErrorMsg error={submitError} />
          <button className="btn btn-block" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Submitting…' : submitted ? 'Save changes' : 'Submit questionnaire'}
          </button>
          <div className="small muted" style={{ textAlign: 'center' }} aria-live="polite">
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'All changes saved' : status === 'error' ? 'Couldn’t save. Check your connection.' : ''}
          </div>
        </div>
      </Card>
    </div>
  )
}

function QuestionField({ q, value, onChange, invalid }: {
  q: Question
  value: Answers[string]
  onChange: (v: Answers[string]) => void
  invalid: boolean
}) {
  // One wrapping span so the asterisk stays on the same line as the question.
  const label = <span>{q.label}{q.required && q.type !== 'confirm' && <span className="req" aria-hidden> *</span>}</span>
  const cls = `field q-field ${invalid ? 'q-missing' : ''}`
  const id = `q-${q.key}`

  switch (q.type) {
    case 'paragraph':
      return (
        <label className={cls} id={id}>{label}
          <textarea rows={4} value={(value as string) ?? ''} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} maxLength={4000} />
        </label>
      )
    case 'single':
      return (
        <div className={cls} id={id} role="radiogroup" aria-label={q.label}>
          {label}
          <div className="chips">
            {q.options!.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={value === o} className={`chip ${value === o ? 'on' : ''}`} onClick={() => onChange(o)}>{o}</button>
            ))}
          </div>
        </div>
      )
    case 'multi': {
      const list = Array.isArray(value) ? value : []
      const toggle = (o: string) => {
        if (o === 'None') return onChange(list.includes('None') ? [] : ['None'])
        const without = list.filter((x) => x !== 'None')
        onChange(without.includes(o) ? without.filter((x) => x !== o) : [...without, o])
      }
      return (
        <div className={cls} id={id} role="group" aria-label={q.label}>
          <span>{label}{q.hint && <span className="hint" style={{ fontWeight: 400 }}> · {q.hint}</span>}</span>
          <div className="chips">
            {q.options!.map((o) => (
              <button key={o} type="button" aria-pressed={list.includes(o)} className={`chip ${list.includes(o) ? 'on' : ''}`} onClick={() => toggle(o)}>{o}</button>
            ))}
          </div>
        </div>
      )
    }
    case 'scale':
      return (
        <div className={cls} id={id}>
          {label}
          <RatingScale label={q.label} value={typeof value === 'number' ? value : null} onChange={onChange} low="Not really" high="All in" />
        </div>
      )
    case 'confirm':
      return (
        <label className={`confirm ${invalid ? 'q-missing' : ''}`} id={id}>
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>{q.label}</span>
        </label>
      )
    default:
      return (
        <label className={cls} id={id}>{label}
          <input
            type={q.type === 'tel' ? 'tel' : 'text'}
            inputMode={q.type === 'number' ? 'numeric' : q.type === 'tel' ? 'tel' : undefined}
            value={value == null ? '' : String(value)}
            placeholder={q.placeholder}
            onChange={(e) => {
              if (q.type !== 'number') return onChange(e.target.value)
              const n = e.target.value.replace(/\D/g, '')
              onChange(n === '' ? null : Number(n))
            }}
          />
        </label>
      )
  }
}
