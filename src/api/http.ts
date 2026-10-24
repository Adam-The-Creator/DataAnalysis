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
  async (error: unknown) => {
    if (error instanceof AxiosError) {
      if (!error.response) {
        throw new ApiError('network')
      }
      const status = error.response.status
      // A 401 without a token is a failed login, not an expired session.
      if (status === 401 && getToken()) {
        notifyUnauthorized()
      }
      throw new ApiError('http', status, detailOf(await readBody(error.response.data)))
    }
    throw error
  },
)

/**
 * The body of an error answer. For downloads (responseType "blob") it arrives as a Blob, so the server's message
 * has to be read out of it, otherwise a "not found" or "forbidden" of an export would lose its text.
 */
async function readBody(data: unknown): Promise<unknown> {
  if (typeof data === 'object' && data !== null && 'text' in data && typeof data.text === 'function') {
    try {
      return JSON.parse(await (data as Blob).text())
    } catch {
      return null
    }
  }
  return data
}

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

export async function put<T>(url: string, body?: unknown): Promise<T> {
  return (await http.put<T>(url, body)).data
}

export async function del<T>(url: string): Promise<T> {
  return (await http.delete<T>(url)).data
}

/** A file or an image. The Authorization header is needed, so these cannot be plain links. */
export async function getBlob(url: string): Promise<Blob> {
  return (await http.get<Blob>(url, { responseType: 'blob' })).data
}

export async function getText(url: string): Promise<string> {
  return (await http.get<string>(url, { responseType: 'text', transformResponse: (data: string) => data })).data
}
