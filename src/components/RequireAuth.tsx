import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Loading } from './ui'
import type { Role } from '../lib/types'

export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading || (session && !profile)) return <Loading />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && profile?.role !== role) return <Navigate to={profile?.role === 'coach' ? '/coach' : '/'} replace />
  return <>{children}</>
}
