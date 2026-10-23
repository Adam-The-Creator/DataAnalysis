import { Navigate } from 'react-router'
import { Role } from '@/api/types'
import { useAuth } from '@/auth/authContext'
import { DashboardPage } from './DashboardPage'

/** The start page depends on the role: the dashboard for psychologists, the own records for players. */
export function RoleHome() {
  const { user } = useAuth()
  return user?.role === Role.Psychologist ? <DashboardPage /> : <Navigate to="/my" replace />
}
