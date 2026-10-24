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

export type AppRole = 'psychologist' | 'player' | 'admin'

const roleValue = { psychologist: Role.Psychologist, player: Role.Player, admin: Role.Admin } as const

/**
 * Restricts a group of routes to one role, or to several. The UI only mirrors the rights: the server decides
 * (requirement AUTH-04).
 */
export function RequireRole({ role }: { role: AppRole | AppRole[] }) {
  const { user } = useAuth()
  const allowed = (Array.isArray(role) ? role : [role]).map((r) => roleValue[r]) as number[]
  if (user && !allowed.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
