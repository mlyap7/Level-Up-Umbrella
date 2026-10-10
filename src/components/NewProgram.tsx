import { useMemo, useState, type FormEvent } from 'react'
import { createProgram, createProgramFromDraft, listTemplates, updateProgram, type FullProgram } from '../lib/api'
import { parseProgramText } from '../lib/programText'
import { useAsync } from '../lib/useAsync'
import { Card, ErrorMsg, Loading } from './ui'
import { ProgramPasteBox, ProgramPreview } from './ProgramPaste'

type Mode = 'template' | 'paste' | 'blank'

export function NewProgram({ clientId, clientName, programs, onCreated }: {
  clientId: string
  clientName: string
  programs: FullProgram[]
  onCreated: () => void
}) {
  const [mode, setMode] = useState<Mode>('template')
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [text, setText] = useState('')
  const [replaceActive, setReplaceActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const templates = useAsync(listTemplates, [])

  const template = templates.data?.find((t) => t.id === templateId)
  const pasted = useMemo(() => (text.trim() ? parseProgramText(text) : null), [text])
  const active = programs.filter((p) => p.active)

  function pickTemplate(id: string) {
    setTemplateId(id)
    const t = templates.data?.find((x) => x.id === id)
    setName(t?.name ?? '')
    setNotes(t?.notes ?? '')
    setDone(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Give the program a name.')
    const workouts = mode === 'template' ? template?.workouts : mode === 'paste' ? pasted?.workouts : undefined
    if (mode !== 'blank' && !workouts?.length) return setError(mode === 'template' ? 'Pick a template first.' : 'Paste a program table first.')
    setBusy(true)
    try {
      if (workouts) await createProgramFromDraft(clientId, name, notes, workouts)
      else await createProgram(clientId, name)
      // Only the new program stays active, so the client isn't shown two plans.
      if (replaceActive) for (const p of active) await updateProgram(p.id, { active: false })
      setDone(`“${name.trim()}” is now on ${clientName}’s Training page.`)
      setName(''); setNotes(''); setText(''); setTemplateId('')
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the program.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="New program">
      <div className="segmented" role="group" aria-label="How to create" style={{ marginBottom: 12 }}>
        <button type="button" aria-pressed={mode === 'template'} onClick={() => { setMode('template'); setDone(null) }}>From a template</button>
        <button type="button" aria-pressed={mode === 'paste'} onClick={() => { setMode('paste'); setName(''); setNotes(''); setDone(null) }}>Paste a table</button>
        <button type="button" aria-pressed={mode === 'blank'} onClick={() => { setMode('blank'); setName(''); setDone(null) }}>Blank</button>
      </div>
      {done && <div className="alert alert-ok" role="status" style={{ marginBottom: 12 }}>{done}</div>}
      <form className="stack" onSubmit={submit}>
        {mode === 'template' && (
          templates.loading && !templates.data ? <Loading /> : (
            <>
              <label className="field">Template
                <select value={templateId} onChange={(e) => pickTemplate(e.target.value)}>
                  <option value="">Choose a template…</option>
                  {templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <ErrorMsg error={templates.error} />
              {template && <p className="small muted" style={{ margin: 0 }}>{template.description}</p>}
            </>
          )
        )}
        {mode === 'paste' && <ProgramPasteBox text={text} onText={setText} />}

        {(mode === 'blank' || (mode === 'template' && template) || (mode === 'paste' && pasted && !pasted.error)) && (
          <>
            <label className="field">Program name
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Block 1: Foundations" />
            </label>
            {mode !== 'blank' && (
              <label className="field">Program notes <span className="hint">Shown to {clientName} above their workouts. Tweak for them if you like.</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} />
              </label>
            )}
            {active.length > 0 && (
              <label className="switch-row">
                <span>
                  <strong>Replace their current program</strong>
                  <span className="small muted" style={{ display: 'block' }}>Sets {active.map((p) => `“${p.name}”`).join(', ')} to inactive. Their logged workouts are kept.</span>
                </span>
                <input type="checkbox" role="switch" className="switch" checked={replaceActive} onChange={(e) => setReplaceActive(e.target.checked)} />
              </label>
            )}
            <ErrorMsg error={error} />
            <div><button className="btn" disabled={busy}>{busy ? 'Saving…' : mode === 'blank' ? 'Create program' : `Give to ${clientName}`}</button></div>
            {mode === 'template' && template && <ProgramPreview workouts={template.workouts} />}
          </>
        )}
      </form>
    </Card>
  )
}
