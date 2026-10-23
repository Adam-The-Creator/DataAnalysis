import { getApiConfig } from './config'
import type { Api } from './contract'
import { liveApi } from './live'
import { mockApi } from './mock'

/** The backend selected on the login page: generated demo data or the live DatabaseServer. */
export function getApi(): Api {
  return getApiConfig().mode === 'demo' ? mockApi : liveApi
}
