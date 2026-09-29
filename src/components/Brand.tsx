import { useState } from 'react'
import { Link } from 'react-router-dom'

// Brand assets. Upload to public/brand/ in the repo:
//   logo.png       full logo (shown on sign-in and sign-up pages)
//   logo-mark.png  optional, just the bolt-and-arrow icon (shown in the header)
// Anything missing falls back to the built-in versions.
const LOGO_SRC = '/brand/logo.png'
const MARK_SRC = '/brand/logo-mark.png'
const FALLBACK_MARK = '/icons/icon.svg'

function Wordmark({ size }: { size?: string }) {
  return (
    <span className="brand-word" style={size ? { fontSize: size } : undefined}>
      LEVEL UP
      <small>TRANSFORMATIONS</small>
    </span>
  )
}

function Mark() {
  const [src, setSrc] = useState(MARK_SRC)
  return <img className="brand-mark" src={src} alt="" onError={() => setSrc(FALLBACK_MARK)} />
}

export function Brand({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="brand" aria-label="Level Up Transformations home">
      <Mark />
      <Wordmark />
    </Link>
  )
}

export function AuthLogo() {
  const [hasLogo, setHasLogo] = useState(true)
  return (
    <div className="auth-logo">
      {hasLogo ? (
        <img src={LOGO_SRC} alt="Level Up Transformations" onError={() => setHasLogo(false)} />
      ) : (
        <div className="brand">
          <Mark />
          <Wordmark size="1.2rem" />
        </div>
      )}
    </div>
  )
}
