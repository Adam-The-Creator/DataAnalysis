import { Navigate } from 'react-router'
import { Role } from '@/api/types'
import { useAuth } from '@/auth/authContext'
import { DashboardPage } from './DashboardPage'

/** The start page depends on the role: the dashboard for psychologists, the admin dashboard, the own records for players. */
export function RoleHome() {
  const { user } = useAuth()
  if (user?.role === Role.Psychologist) return <DashboardPage />
  return <Navigate to={user?.role === Role.Admin ? '/admin' : '/my'} replace />
}
