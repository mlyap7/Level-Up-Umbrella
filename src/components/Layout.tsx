import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { setCoachMode } from '../lib/mode'
import { Brand } from './Brand'
import { IconBook, IconCheck, IconDumbbell, IconHome, IconUser, IconUsers } from './icons'

interface NavItem { to: string; label: string; icon: ReactNode; end?: boolean }

const CLIENT_NAV: NavItem[] = [
  { to: '/', label: 'Progress', icon: <IconHome />, end: true },
  { to: '/training', label: 'Training', icon: <IconDumbbell /> },
  { to: '/check-in', label: 'Check-in', icon: <IconCheck /> },
  { to: '/journal', label: 'Journal', icon: <IconBook /> },
  { to: '/profile', label: 'Profile', icon: <IconUser /> },
]

const COACH_NAV: NavItem[] = [
  { to: '/coach', label: 'Clients', icon: <IconUsers />, end: true },
  { to: '/coach/settings', label: 'Settings', icon: <IconUser /> },
]

export function Layout() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isCoach = profile?.role === 'coach'
  // Coaches see the client screens for their own journey; anything outside
  // /coach counts as "My journey".
  const coaching = isCoach && (pathname === '/coach' || pathname.startsWith('/coach/'))
  const nav = coaching ? COACH_NAV : CLIENT_NAV

  // Remember the side they're on (the home page "/" decides from this, so skip it).
  useEffect(() => {
    if (isCoach && pathname !== '/') setCoachMode(coaching ? 'coaching' : 'journey')
  }, [isCoach, coaching, pathname])
  const switchTo = (mode: 'coaching' | 'journey') => {
    setCoachMode(mode)
    navigate(mode === 'coaching' ? '/coach' : '/')
  }

  // Clients who haven't done the welcome/setup flow go there first.
  // (`=== null` rather than `== null`: undefined means the database update
  // that adds this field hasn't been run yet, so don't send anyone there.)
  if (profile?.role === 'client' && profile.onboarded_at === null) return <Navigate to="/welcome" replace />
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Brand to={coaching ? '/coach' : '/'} />
          <nav className="top-nav" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={cls}>{n.label}</NavLink>
            ))}
          </nav>
          {isCoach && (
            <div className="segmented mode-switch" role="group" aria-label="Switch view">
              <button aria-pressed={coaching} onClick={() => switchTo('coaching')}>Coaching</button>
              <button aria-pressed={!coaching} onClick={() => switchTo('journey')}>My journey</button>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => void signOut()} style={{ marginLeft: isCoach ? undefined : 'auto' }}>
            <span className="signout-label">Sign out</span>
            <span aria-hidden className="signout-icon">↪</span>
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main" style={{ ['--tabs' as string]: nav.length }}>
        {nav.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={cls}>
            {n.icon}
            {n.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
