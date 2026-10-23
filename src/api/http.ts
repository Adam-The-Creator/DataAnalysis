import axios, { AxiosError } from 'axios'
import { getToken, notifyUnauthorized } from '@/auth/tokenStore'
import { getApiConfig } from './config'
import { ApiError } from './errors'

/** Axios instance of the live client: base URL and bearer token are read on every request. */
export const http = axios.create({ timeout: 60_000 })

http.interceptors.request.use((config) => {
  config.baseURL = getApiConfig().baseUrl
  const token = getToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (error instanceof AxiosError) {
      if (!error.response) {
        throw new ApiError('network')
      }
      const status = error.response.status
      // A 401 without a token is a failed login, not an expired session.
      if (status === 401 && getToken()) {
        notifyUnauthorized()
      }
      throw new ApiError('http', status, detailOf(error.response.data))
    }
    throw error
  },
)

/** FastAPI sends either {detail: "text"} or, for validation errors, {detail: [{msg: "..."}]}. */
function detailOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('detail' in data)) {
    return null
  }
  const detail = (data as { detail: unknown }).detail
  if (typeof detail === 'string') {
    return detail
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => (typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : ''))
      .filter(Boolean)
      .join('; ')
  }
  return null
}

export async function get<T>(url: string): Promise<T> {
  return (await http.get<T>(url)).data
}

export async function post<T>(url: string, body: unknown): Promise<T> {
  return (await http.post<T>(url, body)).data
}
