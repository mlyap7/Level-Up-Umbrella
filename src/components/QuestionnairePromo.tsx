import { Link } from 'react-router-dom'
import { claimQuestionnaireImport, getQuestionnaire } from '../lib/api'
import { progress, type Answers } from '../lib/questionnaire'
import { useAsync } from '../lib/useAsync'

/** Dashboard to-do until the client submits their coaching questionnaire. */
export function QuestionnairePromo({ clientId }: { clientId: string }) {
  const { data } = useAsync(async () => {
    try {
      await claimQuestionnaireImport() // picks up answers from the old Google Form, if any
      return { row: await getQuestionnaire(clientId) }
    } catch {
      return null // the questionnaire database update hasn't been run yet
    }
  }, [clientId])
  if (!data || data.row?.submitted_at) return null
  const p = progress((data.row?.answers ?? {}) as Answers)
  const started = p.done > 0
  return (
    <section className="promo-card" aria-label="Coaching questionnaire">
      <span className="tour-icon" aria-hidden>📋</span>
      <div className="grow">
        <h2 style={{ marginBottom: 4 }}>{started ? 'Finish your coaching questionnaire' : 'Complete your coaching questionnaire'}</h2>
        <p className="small" style={{ margin: '0 0 10px' }}>
          {started ? `${p.done} of ${p.total} answered. Pick up where you left off.` : 'About 8 minutes. It helps your coach build the right plan for you. Your answers save as you go.'}
        </p>
        <Link to="/questionnaire" className="btn btn-sm">{started ? 'Continue' : 'Start questionnaire'}</Link>
      </div>
    </section>
  )
}
