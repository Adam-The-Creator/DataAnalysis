/** Where the app gets its data from: generated demo data (no server needed) or the live DatabaseServer. */
export type ApiMode = 'demo' | 'live'

export interface ApiConfig {
  mode: ApiMode
  baseUrl: string
}

const STORAGE_KEY = 'vra.apiConfig'

/**
 * True in the release build, which the DatabaseServer serves itself at /app (vite.config.ts "base", requirement TEC-08).
 * That app talks to the server it came from and to no other: the address is its own origin and cannot be changed, and the
 * Content-Security-Policy the server sends (connect-src 'self', SEC-09) would refuse any other address anyway.
 */
export const servedByServer = import.meta.env.BASE_URL !== '/'

const defaults: ApiConfig = {
  mode: import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'demo',
  // VITE_API_BASE_URL is for development only: a release build always uses its own origin, whatever a .env file says.
  baseUrl: servedByServer ? window.location.origin : (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'),
}

function load(): ApiConfig {
  // Only a per-viewer convenience: the app works without it (private window, blocked storage, ...).
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ApiConfig>
      return {
        mode: stored.mode === 'live' || stored.mode === 'demo' ? stored.mode : defaults.mode,
        baseUrl: !servedByServer && typeof stored.baseUrl === 'string' && stored.baseUrl ? stored.baseUrl : defaults.baseUrl,
      }
    }
  } catch {
    // fall through to the defaults
  }
  return { ...defaults }
}

let current = load()

export function getApiConfig(): ApiConfig {
  return current
}

export function setApiConfig(patch: Partial<ApiConfig>): void {
  const baseUrl = servedByServer ? current.baseUrl : (patch.baseUrl ?? current.baseUrl).trim().replace(/\/+$/, '')
  current = { ...current, ...patch, baseUrl }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // not persisted, still applied for this page
  }
}
