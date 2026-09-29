import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import { AuthLogo } from '../../components/Brand'
import { ErrorMsg, Loading } from '../../components/ui'

// Reached from the password-reset email. Supabase signs the user in from the
// link, so we only need to set the new password.
export function UpdatePassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Loading />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else navigate('/', { replace: true })
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <AuthLogo />
        <h1>Choose a new password</h1>
        {!session ? (
          <p>This reset link has expired or was already used. Request a new one from the sign-in page.</p>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label className="field">New password
              <input type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <ErrorMsg error={error} />
            <button className="btn btn-block" disabled={busy}>Save password</button>
          </form>
        )}
      </div>
    </div>
  )
}
