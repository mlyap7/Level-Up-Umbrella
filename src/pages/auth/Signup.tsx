import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { checkSignupCode } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { AuthLogo } from '../../components/Brand'
import { InAppBrowserNotice } from '../../components/InstallCard'
import { ErrorMsg } from '../../components/ui'

export function Signup() {
  const { session } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    setBusy(true)
    try {
      if (!(await checkSignupCode(code))) {
        setError('That sign-up code isn’t right. Ask your coach for the current code.')
        return
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: name.trim(), signup_code: code.trim() },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) throw error
      // No session means Supabase wants the email confirmed first.
      if (!data.session) setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="auth-wrap">
        <div className="card auth-card">
          <AuthLogo />
          <h1>Check your email</h1>
          <p>We sent a confirmation link to <strong>{email}</strong>. Click it to finish setting up your account.</p>
          <Link to="/login" className="btn btn-secondary btn-block">Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <AuthLogo />
        <InAppBrowserNotice />
        <h1>Create your account</h1>
        <p className="muted">Track your weigh-ins, measurements, training and check-ins in one place.</p>
        <form className="stack" onSubmit={submit}>
          <label className="field">Full name
            <input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">Password <span className="hint">At least 8 characters</span>
            <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">Sign-up code <span className="hint">From your coach, if they gave you one</span>
            <input autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <ErrorMsg error={error} />
          <button className="btn btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
        <p className="small" style={{ marginTop: 16, textAlign: 'center' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
