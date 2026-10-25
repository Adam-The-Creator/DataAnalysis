import { createContext, useContext } from 'react'
import type { RoleValue } from '@/api/types'

export interface AuthUser {
  playerId: string
  role: RoleValue
  name: string
}

export interface AuthContextValue {
  user: AuthUser | null
  /** True after the server rejected the token (expired or invalid). The login page shows it once. */
  expired: boolean
  login(username: string, password: string): Promise<void>
  logout(): void
  /** The name shown in the top bar, after the user changed it on their profile. */
  setName(name: string): void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}
