import type { TFunction } from 'i18next'
import { getApiConfig } from '@/api/config'
import { ApiError } from '@/api/errors'

/** A readable message for the user (requirement TEC-07). */
export function describeError(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network') {
      return t('errors.network', { url: getApiConfig().baseUrl })
    }
    return error.detail ?? t('errors.http', { status: error.status ?? '?' })
  }
  return t('errors.unknown')
}
