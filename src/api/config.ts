/** Where the app gets its data from: generated demo data (no server needed) or the live DatabaseServer. */
export type ApiMode = 'demo' | 'live'

export interface ApiConfig {
  mode: ApiMode
  baseUrl: string
}

const STORAGE_KEY = 'vra.apiConfig'

const defaults: ApiConfig = {
  mode: import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'demo',
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000',
}

function load(): ApiConfig {
  // Only a per-viewer convenience: the app works without it (private window, blocked storage, ...).
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw) as Partial<ApiConfig>
      return {
        mode: stored.mode === 'live' || stored.mode === 'demo' ? stored.mode : defaults.mode,
        baseUrl: typeof stored.baseUrl === 'string' && stored.baseUrl ? stored.baseUrl : defaults.baseUrl,
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
  current = { ...current, ...patch, baseUrl: (patch.baseUrl ?? current.baseUrl).trim().replace(/\/+$/, '') }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch {
    // not persisted, still applied for this page
  }
}
