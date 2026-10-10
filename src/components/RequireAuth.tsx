import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Loading } from './ui'
import type { Role } from '../lib/types'

// role="coach" limits a page to coaches. Everyone else's pages are open to any
// signed-in person, since coaches use them to track their own journey.
export function RequireAuth({ role, children }: { role?: Extract<Role, 'coach'>; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading || (session && !profile)) return <Loading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && profile?.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}
