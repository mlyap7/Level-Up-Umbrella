import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AuthLogo } from '../../components/Brand'
import { ErrorMsg } from '../../components/ui'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/update-password`,
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <AuthLogo />
        <h1>Reset your password</h1>
        {sent ? (
          <p>If an account exists for <strong>{email}</strong>, a reset link is on its way.</p>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label className="field">Email
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <ErrorMsg error={error} />
            <button className="btn btn-block" disabled={busy}>Send reset link</button>
          </form>
        )}
        <p className="small" style={{ marginTop: 16, textAlign: 'center' }}><Link to="/login">Back to sign in</Link></p>
      </div>
    </div>
  )
}
