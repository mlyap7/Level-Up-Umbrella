import { getQuestionnaire } from '../lib/api'
import { formatFullDate, toISODate } from '../lib/dates'
import { formatAnswer, isVisible, QUESTIONNAIRE, type Answers } from '../lib/questionnaire'
import { useAsync } from '../lib/useAsync'
import { Card, ErrorMsg, Loading } from './ui'

/** Coach's read-only view of a client's questionnaire. */
export function QuestionnaireView({ clientId }: { clientId: string }) {
  const { data, error, loading } = useAsync(() => getQuestionnaire(clientId), [clientId])
  if (loading && data === null) return <Loading />
  if (error) return <ErrorMsg error={error} />
  if (!data) return <Card><div className="empty">Not started yet. It shows on their dashboard as a to-do.</div></Card>

  const a = data.answers as Answers
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="small muted">
        {data.submitted_at
          ? `Submitted ${formatFullDate(toISODate(new Date(data.submitted_at)))}${data.imported ? ' (imported from the Google Form)' : ''}. Last updated ${formatFullDate(toISODate(new Date(data.updated_at)))}.`
          : 'In progress: not submitted yet.'}
      </div>
      {QUESTIONNAIRE.map((s) => (
        <Card key={s.id} title={s.title}>
          <dl className="q-answers">
            {s.questions.filter((q) => isVisible(q, a) && q.type !== 'confirm').map((q) => (
              <div key={q.key}>
                <dt>{q.label}</dt>
                <dd>{formatAnswer(q, a[q.key])}</dd>
              </div>
            ))}
            {s.questions.filter((q) => q.type === 'confirm').map((q) => (
              <div key={q.key}>
                <dt>{q.key === 'medical_confirmation' ? 'Medical confirmation' : 'Commitment declaration'}</dt>
                <dd>{formatAnswer(q, a[q.key])}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  )
}
