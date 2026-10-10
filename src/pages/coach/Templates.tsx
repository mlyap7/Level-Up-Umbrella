import { useState, type FormEvent } from 'react'
import { deleteTemplate, listTemplates, saveTemplate } from '../../lib/api'
import { parseProgramText, programToText } from '../../lib/programText'
import type { ProgramTemplate } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Card, ErrorMsg, Loading } from '../../components/ui'
import { ProgramPasteBox, ProgramPreview } from '../../components/ProgramPaste'

export function Templates() {
  const { data, error, loading, reload } = useAsync(listTemplates, [])
  const [editing, setEditing] = useState<ProgramTemplate | 'new' | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  if (loading && !data) return <Loading />
  if (error || !data) return <ErrorMsg error={error ?? 'Could not load templates.'} />

  if (editing) {
    return <TemplateForm template={editing === 'new' ? null : editing} onDone={() => { setEditing(null); reload() }} />
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row-between">
        <h1>Program templates</h1>
        <button className="btn btn-sm" onClick={() => setEditing('new')}>New template</button>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Give a client a template from their Training tab. Changing a template here doesn’t change programs you’ve already given out.
      </p>
      {data.length === 0 && <Card><div className="empty">No templates yet.</div></Card>}
      {data.map((t) => {
        const exercises = t.workouts.reduce((n, w) => n + w.exercises.length, 0)
        return (
          <Card key={t.id} title={t.name} action={
            <div className="row" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === t.id ? null : t.id)}>{open === t.id ? 'Hide' : 'View'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(t)}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={async () => {
                if (!confirm(`Delete the “${t.name}” template? Programs already given to clients are kept.`)) return
                await deleteTemplate(t.id)
                reload()
              }}>Delete</button>
            </div>
          }>
            {t.description && <p className="small" style={{ marginTop: 0 }}>{t.description}</p>}
            <div className="small muted">{t.workouts.map((w) => w.name).join(' · ')} · {exercises} exercises</div>
            {open === t.id && (
              <div style={{ marginTop: 8 }}>
                {t.notes && <p className="small" style={{ whiteSpace: 'pre-wrap' }}>{t.notes}</p>}
                <ProgramPreview workouts={t.workouts} />
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function TemplateForm({ template, onDone }: { template: ProgramTemplate | null; onDone: () => void }) {
  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [notes, setNotes] = useState(template?.notes ?? '')
  const [text, setText] = useState(template ? programToText(template.workouts) : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = parseProgramText(text)
    if (!name.trim()) return setError('Give the template a name.')
    if (parsed.error) return setError(parsed.error)
    setBusy(true)
    try {
      await saveTemplate({ id: template?.id, name, description, notes, workouts: parsed.workouts })
      onDone()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save.'
      setError(/duplicate|unique/i.test(msg) ? 'There’s already a template with that name.' : msg)
      setBusy(false)
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div>
        <button className="link-btn small" onClick={onDone}>← All templates</button>
        <h1 style={{ marginTop: 4 }}>{template ? 'Edit template' : 'New template'}</h1>
      </div>
      <Card>
        <form className="stack" onSubmit={submit}>
          <label className="field">Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Beginner Full Body 3x (Gym)" />
          </label>
          <label className="field">Who it’s for <span className="hint">Only coaches see this</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} placeholder="e.g. New gym clients, 3 days a week" />
          </label>
          <label className="field">Program notes <span className="hint">Shown to the client above their workouts</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
          </label>
          <div className="field">Workouts
            {template && <span className="hint">Tip: copy this table into Google Sheets to edit it comfortably, then paste it back.</span>}
          </div>
          <ProgramPasteBox text={text} onText={setText} />
          <ErrorMsg error={error} />
          <div className="row">
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save template'}</button>
            <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>
          </div>
        </form>
      </Card>
    </div>
  )
}
