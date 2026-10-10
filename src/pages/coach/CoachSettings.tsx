import { useState, type FormEvent } from 'react'
import { getSignupCode, setSignupCode } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Card, ErrorMsg, Loading } from '../../components/ui'
import { Link } from 'react-router-dom'

export function CoachSettings() {
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>Settings</h1>
      <SignupCodeCard />
      <Card title="Your profile and reminders">
        <p className="small" style={{ margin: 0 }}>Your name, units, goals and reminders are in <Link to="/profile">My journey → Profile</Link>.</p>
      </Card>
    </div>
  )
}

function SignupCodeCard() {
  const { data, error, loading, setData } = useAsync(getSignupCode, [])
  const [draft, setDraft] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const signupUrl = `${window.location.origin}/signup`

  if (loading && data == null) return <Loading />
  const value = draft ?? data ?? ''

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaveError(null)
    try {
      await setSignupCode(value)
      setData(value.trim())
      setDraft(null)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  return (
    <Card title="Invite clients">
      <p className="small">Send new clients this link:</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <code className="grow" style={{ background: 'var(--surface-2)', padding: '8px 10px', borderRadius: 6, overflowWrap: 'anywhere' }}>{signupUrl}</code>
        <button className="btn btn-secondary btn-sm" onClick={() => void navigator.clipboard?.writeText(signupUrl)}>Copy</button>
      </div>
      <form className="stack" onSubmit={save}>
        <label className="field">Sign-up code
          <span className="hint">Only people with this code can create an account. Leave empty to let anyone with the link sign up. Change it any time; existing clients aren’t affected.</span>
          <input value={value} onChange={(e) => { setDraft(e.target.value); setSaved(false) }} placeholder="e.g. LEVELUP2026" />
        </label>
        <ErrorMsg error={error ?? saveError} />
        {saved && <div className="alert alert-ok" role="status">{value.trim() ? 'Sign-up code saved.' : 'Sign-up is open to anyone with the link.'}</div>}
        <div><button className="btn">Save code</button></div>
      </form>
      {!(data ?? '').trim() && <div className="alert alert-info" style={{ marginTop: 12 }}>Tip: set a code so strangers who find the link can’t create accounts.</div>}
    </Card>
  )
}
