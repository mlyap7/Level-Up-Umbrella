import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { AuthLogo } from '../../components/Brand'
import { ErrorMsg } from '../../components/ui'

export function Login() {
  const { session, profile } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session && profile) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? (profile.role === 'coach' ? '/coach' : '/')} replace />
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <AuthLogo />
        <h1>Welcome back</h1>
        <p className="muted">Sign in to log your progress.</p>
        <form className="stack" onSubmit={submit}>
          <label className="field">Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">Password
            <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <ErrorMsg error={error} />
          <button className="btn btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="row-between small" style={{ marginTop: 16 }}>
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  )
}
