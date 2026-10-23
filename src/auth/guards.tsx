import { Navigate, Outlet, useLocation } from 'react-router'
import { Role } from '@/api/types'
import { useAuth } from './authContext'

/** Everything inside needs a logged in user. */
export function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

/**
 * Restricts a group of routes to one role. The UI only mirrors the rights: the server decides
 * (requirement AUTH-04).
 */
export function RequireRole({ role }: { role: 'psychologist' | 'player' }) {
  const { user } = useAuth()
  const wanted = role === 'psychologist' ? Role.Psychologist : Role.Player
  if (user && user.role !== wanted) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
