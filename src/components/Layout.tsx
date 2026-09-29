import { NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
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
  const nav = profile?.role === 'coach' ? COACH_NAV : CLIENT_NAV
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          <Brand to={profile?.role === 'coach' ? '/coach' : '/'} />
          <nav className="top-nav" aria-label="Main">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={cls}>{n.label}</NavLink>
            ))}
          </nav>
          <button className="btn btn-ghost btn-sm" onClick={() => void signOut()} style={{ marginLeft: 'auto' }}>
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
