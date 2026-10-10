import { useMemo, useState } from 'react'
import { AI_PROGRAM_PROMPT, demoLink, parseProgramText, type ExerciseDraft, type WorkoutDraft } from '../lib/programText'

export function exerciseSummary(e: Pick<ExerciseDraft, 'sets' | 'reps' | 'rpe' | 'rest' | 'tempo'>): string {
  return [
    e.sets != null && e.reps ? `${e.sets} × ${e.reps}` : e.sets != null ? `${e.sets} sets` : e.reps,
    e.rpe != null && `RPE ${e.rpe}`,
    e.rest && `Rest ${e.rest}`,
    e.tempo && `Tempo ${e.tempo}`,
  ].filter(Boolean).join(' · ')
}

/** Read-only view of a program before it's saved. */
export function ProgramPreview({ workouts }: { workouts: WorkoutDraft[] }) {
  return (
    <div className="program-preview">
      {workouts.map((w) => (
        <div key={w.name} className="exercise-block">
          <h3 style={{ margin: '0 0 6px' }}>{w.name}</h3>
          <ol className="preview-list">
            {w.exercises.map((e, i) => (
              <li key={i}>
                <div className="row-between" style={{ flexWrap: 'nowrap', alignItems: 'baseline' }}>
                  <strong>{e.name}</strong>
                  <a className="small" style={{ whiteSpace: 'nowrap', marginLeft: 8 }} href={demoLink(e.name, e.video_url)} target="_blank" rel="noreferrer">{e.video_url ? 'Video' : 'How to'} ▶</a>
                </div>
                <div className="small">{exerciseSummary(e)}</div>
                {e.notes && <div className="small muted">{e.notes}</div>}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  )
}

/** Textarea that turns a pasted table into workouts, with a live preview. */
export function ProgramPasteBox({ text, onText }: { text: string; onText: (t: string) => void }) {
  const [copied, setCopied] = useState(false)
  const parsed = useMemo(() => (text.trim() ? parseProgramText(text) : null), [text])
  const count = parsed?.workouts.reduce((n, w) => n + w.exercises.length, 0) ?? 0
  return (
    <div className="stack-sm">
      <div className="small">
        Ask Claude, Grok or any AI chat for a program using our prompt, then paste its table here.
        Cells copied from Google Sheets or Excel work too.
        {' '}<button type="button" className="link-btn" onClick={() => {
          void navigator.clipboard?.writeText(AI_PROGRAM_PROMPT).then(() => setCopied(true))
        }}>{copied ? 'Prompt copied ✓' : 'Copy the AI prompt'}</button>
      </div>
      <textarea value={text} onChange={(e) => onText(e.target.value)} rows={8} aria-label="Program table"
        placeholder={'Workout | Exercise | Sets | Reps | RPE | Rest | Tempo | Notes\nDay A | Goblet squat | 3 | 8-10 | 7 | 90s | 3-1-1 | Chest tall'}
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '.8rem' }} />
      {parsed?.error && <div className="alert alert-error" role="alert">{parsed.error}</div>}
      {parsed && !parsed.error && (
        <>
          <div className="alert alert-ok" role="status">
            Found {parsed.workouts.length} workout{parsed.workouts.length === 1 ? '' : 's'} and {count} exercise{count === 1 ? '' : 's'}. Check the preview below.
          </div>
          {parsed.warnings.length > 0 && (
            <div className="alert alert-info"><ul style={{ margin: 0, paddingLeft: 18 }}>{parsed.warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>
          )}
          <ProgramPreview workouts={parsed.workouts} />
        </>
      )}
    </div>
  )
}
