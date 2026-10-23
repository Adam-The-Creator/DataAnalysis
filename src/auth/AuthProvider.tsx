import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getApi } from '@/api'
import { ApiError } from '@/api/errors'
import { Role } from '@/api/types'
import { displayName } from '@/lib/format'
import { queryClient } from '@/queryClient'
import { AuthContext, type AuthUser } from './authContext'
import { setToken, setUnauthorizedHandler } from './tokenStore'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [expired, setExpired] = useState(false)

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    queryClient.clear() // nothing of the previous user may stay in the cache
  }, [])

  // The server rejected the token (expired or invalid): back to the login page.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout()
      setExpired(true)
    })
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const login = useCallback(async (username: string, password: string) => {
    const api = getApi()
    setExpired(false)
    const result = await api.auth.login(username, password)
    setToken(result.accessToken)
    try {
      // The login answer carries no role, so it is asked for next (an endpoint a player may call for themself).
      const [role, info] = await Promise.all([
        api.auth.role(result.playerId),
        api.players.info(result.playerId),
      ])
      if (role !== Role.Psychologist && role !== Role.Player) {
        throw new ApiError('http', 403)
      }
      setUser({ playerId: result.playerId, role, name: displayName(info, result.playerId) })
    } catch (error) {
      setToken(null)
      throw error
    }
  }, [])

  const value = useMemo(() => ({ user, expired, login, logout }), [user, expired, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
